/// <reference types="cypress" />

describe('Mercado Pago return handling', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
  });

  it('renders the current pending-post-payment state from stored order snapshot', () => {
    const order = {
      id: '71b758e2-224f-4f3d-b583-7f8f84946719',
      customer_email: 'qa.checkout@nexcard.cl',
      amount_cents: 19990,
      payment_method: 'mercado-pago',
      payment_status: 'success',
      fulfillment_status: 'new',
      created_at: '2026-05-11T00:58:40.737Z',
    };

    cy.visit('/?payment=success&order=71b758e2-224f-4f3d-b583-7f8f84946719', {
      onBeforeLoad(win) {
        win.sessionStorage.setItem('nexcard_last_order_snapshot', JSON.stringify(order));
      },
    });

    cy.contains('h1', 'Orden Recibida', { timeout: 10000 }).should('exist');
    cy.contains('Pendiente de confirmación').should('exist');
    cy.contains(/qa\.checkout@nexcard\.cl/i).should('exist');
    cy.contains(/mercado pago/i).should('exist');
    cy.contains(/\$19\.990/i).should('exist');
    cy.contains(/tu orden fue recibida\. el pago está siendo verificado\./i).should('exist');
    cy.contains(/una vez confirmado el pago, procederemos con el empaque y envío/i).should('exist');
    cy.contains(/recibirás un seguimiento con tu número de guía de despacho/i).should('exist');
  });
});
