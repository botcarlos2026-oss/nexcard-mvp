/// <reference types="cypress" />

// Covers TC-05: Setup Wizard

describe('Setup Wizard', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginUI();
    cy.visit('/setup');
  });

  it('completes wizard personal flow', () => {
    cy.contains(/uso personal/i).click();
    cy.get('[data-cy=wizard-name]').type('Test Persona');
    cy.findByRole('button', { name: /siguiente/i }).click();
    cy.findByRole('button', { name: /siguiente/i }).click();
    cy.contains(/color/i).parent().find('button').first().click();
    cy.findByRole('button', { name: /siguiente/i }).click();
    cy.get('[data-cy=wizard-whatsapp]').type('56911112222');
    cy.findByRole('button', { name: /finalizar nexcard/i }).click();
    cy.location('pathname', { timeout: 8000 }).should('include', '/edit');
  });
});
