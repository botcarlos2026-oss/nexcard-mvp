/// <reference types="cypress" />

describe('Admin profiles history view', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginUI();
  });

  it('loads /admin/profiles and shows history-aware dataset', () => {
    cy.visit('/admin/profiles');
    cy.get('[data-cy=admin-profiles-table]').should('exist');
    cy.contains(/profiles recovery desk/i).should('exist');
    cy.contains(/versions/i).should('exist');
    cy.contains(/last event/i).should('exist');
  });
});
