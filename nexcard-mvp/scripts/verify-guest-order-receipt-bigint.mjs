import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const containerName = `nexcard-guest-receipt-bigint-${process.pid}`;
const baseMigration = fs.readFileSync(
  path.join(repoRoot, 'supabase/migrations/202611091500_secure_guest_order_receipt.sql'),
  'utf8'
);
const correctiveMigration = fs.readFileSync(
  path.join(repoRoot, 'supabase/migrations/202611092307_fix_guest_order_receipt_amount_type.sql'),
  'utf8'
);
const expectedColumns = [
  'amount_cents',
  'created_at',
  'currency',
  'customer_email',
  'folio',
  'fulfillment_status',
  'id',
  'paid_at',
  'payment_method',
  'payment_status',
  'updated_at',
];
const minSignedBigintAmount = '-9223372036854775808';
const maxSignedBigintAmount = '9223372036854775807';

function runDocker(args, input) {
  const result = spawnSync('docker', args, {
    input,
    encoding: 'utf8',
    stdio: input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    throw new Error(`docker ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }

  return result.stdout.trim();
}

function psql(sql) {
  return runDocker(
    ['exec', '-i', containerName, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres', '-At'],
    sql
  );
}

function psqlAsAnon(sql) {
  return psql(`set role anon;\n${sql}`)
    .split('\n')
    .filter((line) => line !== 'SET')
    .join('\n');
}

async function waitForPostgres() {
  const deadline = Date.now() + 60000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      psql('select 1;');
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error(`PostgreSQL did not become ready: ${lastError?.message ?? 'unknown error'}`);
}

try {
  execFileSync(
    'docker',
    ['run', '--rm', '-d', '--name', containerName, '-e', 'POSTGRES_PASSWORD=postgres', 'postgres:15-alpine'],
    { stdio: 'pipe' }
  );
  await waitForPostgres();

  psql(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    grant usage on schema public to anon, authenticated, service_role;

    create table public.orders (
      id uuid primary key,
      folio text not null,
      customer_email text not null,
      payment_method text not null,
      payment_status text not null,
      paid_at timestamptz,
      fulfillment_status text not null,
      amount_cents bigint not null,
      currency text not null,
      created_at timestamptz not null,
      updated_at timestamptz not null,
      client_checkout_attempt_id text not null,
      client_checkout_fingerprint text not null,
      deleted_at timestamptz,
      customer_phone text,
      customer_address text,
      invoice_rut text
    );
    alter table public.orders enable row level security;
  `);

  psql(baseMigration);
  psql(correctiveMigration);

  psql(`
    insert into public.orders (
      id, folio, customer_email, payment_method, payment_status, paid_at,
      fulfillment_status, amount_cents, currency, created_at, updated_at,
      client_checkout_attempt_id, client_checkout_fingerprint,
      customer_phone, customer_address, invoice_rut
    ) values
      (
        '11111111-1111-1111-1111-111111111111', 'NC-9001', 'qa@example.test', 'mercadopago', 'pending', null,
        'pending', ${minSignedBigintAmount}, 'CLP', now(), now(), 'attempt-min-signed-bigint', 'fingerprint-min-signed-bigint',
        '+569****0000', 'Hidden St 1', '11.111.111-1'
      ),
      (
        '22222222-2222-2222-2222-222222222222', 'NC-9002', 'qa-max@example.test', 'mercadopago', 'pending', null,
        'pending', ${maxSignedBigintAmount}, 'CLP', now(), now(), 'attempt-max-signed-bigint', 'fingerprint-max-signed-bigint',
        '+569****0001', 'Hidden St 2', '22.222.222-2'
      );
  `);

  const valid = psqlAsAnon(`
    select count(*) from public.get_guest_order_receipt(
      '11111111-1111-1111-1111-111111111111', 'attempt-min-signed-bigint', 'fingerprint-min-signed-bigint'
    );
  `);
  const wrongAttempt = psqlAsAnon(`
    select count(*) from public.get_guest_order_receipt(
      '11111111-1111-1111-1111-111111111111', 'attempt-wrong', 'fingerprint-min-signed-bigint'
    );
  `);
  const wrongFingerprint = psqlAsAnon(`
    select count(*) from public.get_guest_order_receipt(
      '11111111-1111-1111-1111-111111111111', 'attempt-min-signed-bigint', 'fingerprint-wrong'
    );
  `);
  const minSignedBigintAmountResult = psqlAsAnon(`
    select amount_cents from public.get_guest_order_receipt(
      '11111111-1111-1111-1111-111111111111', 'attempt-min-signed-bigint', 'fingerprint-min-signed-bigint'
    );
  `);
  // These are PostgreSQL signed-bigint round-trip probes, not commercial amount validation.
  const maxSignedBigintAmountResult = psqlAsAnon(`
    select amount_cents from public.get_guest_order_receipt(
      '22222222-2222-2222-2222-222222222222', 'attempt-max-signed-bigint', 'fingerprint-max-signed-bigint'
    );
  `);
  const allowlist = psqlAsAnon(`
    select jsonb_object_keys(to_jsonb(receipt))
    from public.get_guest_order_receipt(
      '11111111-1111-1111-1111-111111111111', 'attempt-min-signed-bigint', 'fingerprint-min-signed-bigint'
    ) as receipt
    order by 1;
  `)
    .split('\n')
    .filter(Boolean);

  if (valid !== '1') throw new Error(`expected valid=1, got ${valid}`);
  if (wrongAttempt !== '0' || wrongFingerprint !== '0') {
    throw new Error(`expected wrong=0, got attempt=${wrongAttempt}, fingerprint=${wrongFingerprint}`);
  }
  if (minSignedBigintAmountResult !== minSignedBigintAmount) {
    throw new Error(
      `expected min signed bigint amount ${minSignedBigintAmount}, got ${minSignedBigintAmountResult}`
    );
  }
  if (maxSignedBigintAmountResult !== maxSignedBigintAmount) {
    throw new Error(
      `expected max signed bigint amount ${maxSignedBigintAmount}, got ${maxSignedBigintAmountResult}`
    );
  }
  if (JSON.stringify(allowlist) !== JSON.stringify(expectedColumns)) {
    throw new Error(`receipt allowlist mismatch: ${allowlist.join(',')}`);
  }

  console.log('valid_receipt=1');
  console.log('wrong_receipt=0');
  console.log(`min_signed_amount_cents=${minSignedBigintAmount}`);
  console.log(`max_signed_amount_cents=${maxSignedBigintAmount}`);
  console.log('allowlist=exact');
} finally {
  spawnSync('docker', ['rm', '-f', containerName], { stdio: 'ignore' });
}
