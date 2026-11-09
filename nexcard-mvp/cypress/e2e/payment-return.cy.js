/// <reference types="cypress" />

const ORDER_ID = '71b758e2-224f-4f3d-b583-7f8f84946719';
const ORDER_PROOF = {
  orderId: ORDER_ID,
  clientCheckoutAttemptId: 'a77e9a1a-902e-4c8f-b63e-68216d8e3e69',
  clientCheckoutFingerprint: 'qa-payment-return-fingerprint',
};
const ORDER_SNAPSHOT = {
  id: ORDER_ID,
  customer_email: 'qa.payment-return@example.invalid',
  amount_cents: 19990,
  payment_method: 'mercado-pago',
  payment_status: 'pending',
  fulfillment_status: 'new',
  created_at: '2026-05-11T00:58:40.737Z',
};
const PENDING_RECEIPT = {
  ...ORDER_SNAPSHOT,
  folio: 'NX-QA-PENDING',
  payment_status: 'pending',
};
const PAID_RECEIPT = {
  ...PENDING_RECEIPT,
  folio: 'NX-QA-PAID',
  payment_status: 'paid',
};

function stubFixtureLandingContent() {
  cy.intercept('GET', '**/rest/v1/content_blocks*', {
    statusCode: 406,
    body: { message: 'Local return fixture has no landing content.' },
  }).as('fixtureLandingContent');
}

function assertNoOrderReads() {
  let directOrderReads = 0;

  cy.intercept('GET', '**/rest/v1/orders*', (request) => {
    directOrderReads += 1;
    request.reply({
      statusCode: 500,
      body: { message: 'Direct order reads are forbidden on a guest return.' },
    });
  }).as('unexpectedOrderRead');

  return () => cy.then(() => {
    expect(directOrderReads, 'direct GET /rest/v1/orders requests').to.equal(0);
  });
}

describe('Mercado Pago return handling', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    stubFixtureLandingContent();
    cy.intercept('POST', 'https://www.google-analytics.com/g/collect*', {
      statusCode: 204,
      body: '',
    }).as('blockedAnalytics');
  });

  it('polls the authorized receipt from pending to paid without reading orders directly', () => {
    let receiptRequests = 0;
    const assertNoDirectOrderReads = assertNoOrderReads();

    cy.intercept('POST', '**/rest/v1/rpc/get_guest_order_receipt', (request) => {
      receiptRequests += 1;
      expect(request.body).to.deep.equal({
        p_order_id: ORDER_ID,
        p_checkout_attempt_id: ORDER_PROOF.clientCheckoutAttemptId,
        p_checkout_fingerprint: ORDER_PROOF.clientCheckoutFingerprint,
      });
      request.reply({
        statusCode: 200,
        body: receiptRequests === 1 ? [PENDING_RECEIPT] : [PAID_RECEIPT],
      });
    }).as('guestOrderReceipt');

    cy.visit(`/?payment=success&order=${ORDER_ID}`, {
      onBeforeLoad(win) {
        // React StrictMode remounts this effect in Vite development. Retain the
        // return params through that remount so the live receipt poll executes.
        win.history.replaceState = () => {};
        win.sessionStorage.setItem('nexcard_last_order_snapshot', JSON.stringify(ORDER_SNAPSHOT));
        win.sessionStorage.setItem('nexcard_last_order_proof', JSON.stringify(ORDER_PROOF));
      },
    });

    cy.contains('h1', 'Orden Recibida', { timeout: 10000 }).should('exist');
    cy.contains(/confirmando tu pago/i).should('exist');
    cy.wait('@guestOrderReceipt');
    cy.contains('Pendiente de confirmación').should('exist');
    cy.wait('@guestOrderReceipt');
    cy.contains('h1', '¡Orden Confirmada!').should('exist');
    cy.contains('Pago confirmado').should('exist');
    cy.contains('NX-QA-PAID').should('exist');
    cy.contains(ORDER_SNAPSHOT.customer_email).should('exist');
    cy.contains('$19.990').should('exist');
    cy.contains('Mercado Pago').should('exist');
    cy.then(() => {
      expect(receiptRequests, 'scoped receipt RPC requests').to.equal(2);
    });
    assertNoDirectOrderReads();
  });

  it('shows a generic confirmation without a proof and never calls the receipt RPC', () => {
    let receiptRequests = 0;
    const assertNoDirectOrderReads = assertNoOrderReads();

    cy.intercept('POST', '**/rest/v1/rpc/get_guest_order_receipt', (request) => {
      receiptRequests += 1;
      request.reply({ statusCode: 500, body: { message: 'A proof is required.' } });
    }).as('unexpectedGuestOrderReceipt');

    cy.visit(`/?payment=success&order=${ORDER_ID}`);

    cy.contains('h1', 'Orden Recibida', { timeout: 10000 }).should('exist');
    cy.contains('Revisaremos tu orden y te contactaremos si necesitamos más información.').should('exist');
    cy.contains('Email').should('not.exist');
    cy.contains('Total de la orden').should('not.exist');
    cy.contains('Método de Pago').should('not.exist');
    cy.then(() => {
      expect(receiptRequests, 'receipt RPC requests without proof').to.equal(0);
    });
    assertNoDirectOrderReads();
  });
});
