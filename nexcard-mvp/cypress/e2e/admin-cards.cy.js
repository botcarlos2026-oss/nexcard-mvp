/// <reference types="cypress" />

describe('Admin cards view', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginUI();
  });

  it('loads /admin/cards and shows cards dataset', () => {
    cy.visit('/admin/cards');
    cy.get('[data-cy=admin-cards-table]').should('exist');
    cy.contains(/NXC-/i).should('exist');
  });
});
