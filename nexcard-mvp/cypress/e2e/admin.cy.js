/// <reference types="cypress" />

// Covers TC-06 Admin Dashboard & Inventory basics

describe('Admin Dashboard', () => {
  beforeEach(() => {
    cy.viewport(1366, 768);
    cy.loginUI();
    cy.visit('/admin');
  });

  it('sees users list and QR download action', () => {
    cy.contains(/usuarios|users/i).should('exist');
    cy.get('table').within(() => {
      cy.contains(/carlos/i).should('exist');
    });
    cy.get('button,svg').filter(':contains("QR")').first().click({ force: true });
  });

  it('navigates to inventory and sees items', () => {
    cy.contains(/inventario/i).click();
    cy.contains(/Tarjetas PVC en blanco|Chips NFC/i).should('exist');
  });
});
