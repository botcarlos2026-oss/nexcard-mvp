/// <reference types="cypress" />

describe('Mercado Pago return handling', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
  });

  it('renders confirmation page from stored order snapshot on success return', () => {
    const order = {
      id: '71b758e2-224f-4f3d-b583-7f8f84946719',
      customer_email: 'qa.checkout@nexcard.cl',
      amount_cents: 19990,
      payment_method: 'mercado-pago',
      fulfillment_status: 'new',
      created_at: '2026-05-11T00:58:40.737Z',
    };

    cy.visit('/?payment=success&order=71b758e2-224f-4f3d-b583-7f8f84946719', {
      onBeforeLoad(win) {
        win.sessionStorage.setItem('nexcard_last_order_snapshot', JSON.stringify(order));
      },
    });

    cy.contains(/orden confirmada/i, { timeout: 10000 }).should('exist');
    cy.contains(/qa\.checkout@nexcard\.cl/i).should('exist');
    cy.contains(/mercado pago/i).should('exist');
    cy.contains(/\$19\.990/i).should('exist');
    cy.contains(/pago confirmado/i).should('exist');
  });
});
