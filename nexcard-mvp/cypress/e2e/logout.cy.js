/// <reference types="cypress" />

// TC-09 Logout simple

describe('Logout flow', () => {
  it('logs out from header/menu', () => {
    cy.loginUI();
    cy.get('button, a').contains(/cerrar sesión|logout/i).click({ force: true });
    cy.location('pathname', { timeout: 8000 }).should('include', '/login');
  });
});
