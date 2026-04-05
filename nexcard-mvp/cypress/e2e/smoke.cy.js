/// <reference types="cypress" />

// Smoke covering login, edit, admin, public profile

describe('NexCard smoke flow', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
  });

  it('login via UI and reach /edit', () => {
    cy.loginUI();
    cy.contains(/editor/i, { matchCase: false }).should('exist');
  });

  it('public profile carlos-alvarez loads', () => {
    cy.visit('/carlos-alvarez');
    cy.contains('Carlos Alvarez').should('exist');
    cy.contains(/Head of Operations/i).should('exist');
    cy.findAllByRole('button', { name: /Guardar Contacto/i }).first().click();
  });

  it('admin dashboard shows datasets', () => {
    cy.loginUI();
    cy.visit('/admin');
    cy.get('[data-cy=admin-inventory]').should('exist');
  });
});
