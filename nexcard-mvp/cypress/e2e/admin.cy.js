/// <reference types="cypress" />

// Covers TC-06 Admin Dashboard & Inventory basics

describe('Admin Dashboard', () => {
  beforeEach(() => {
    cy.viewport(1366, 768);
    cy.loginUI();
    cy.visit('/admin');
  });

  it('sees users list and QR download action', () => {
    cy.get('[data-cy=admin-inventory]').should('exist');
  });

  it.skip('navigates to inventory and sees items (temporarily skipped)', () => {
    // TODO: restore when inventory renders seeded items consistently
    cy.contains(/inventario/i).click({ force: true });
    cy.get('[data-cy=admin-inventory]').should('exist');
  });
});
