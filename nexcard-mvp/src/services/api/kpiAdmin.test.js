import { validateKpiRuntimeConfig } from './kpiAdmin';

describe('kpiAdmin', () => {
  it('acepta config válida de SLA', () => {
    expect(() => validateKpiRuntimeConfig('sla_targets', {
      paid_to_ready: 24,
      ready_to_shipped: 24,
    })).not.toThrow();
  });

  it('rechaza campos desconocidos', () => {
    expect(() => validateKpiRuntimeConfig('sla_targets', {
      foo: 1,
    })).toThrow(/Campos no permitidos/);
  });

  it('rechaza flags inválidos en routing ejecutivo', () => {
    expect(() => validateKpiRuntimeConfig('executive_alert_routing', {
      enabled: 2,
    })).toThrow(/debe ser 0 o 1/);
  });

  it('acepta texto en policy por banda', () => {
    expect(() => validateKpiRuntimeConfig('executive_alert_band_policy', {
      kill_switch: 0,
      watch_recipients_csv: 'a@test.com,b@test.com',
    })).not.toThrow();
  });
});
