/// <reference types="cypress" />

// TC-01 Login / TC-02 Registro básico (registro en staging puede requerir correo real)

describe('Auth flows', () => {
  const email = `qa+${Date.now()}@example.com`;
  const password = 'Test12345!';

  it('login with existing admin user (from env)', () => {
    cy.loginUI();
    cy.location('pathname').should('match', /edit|admin/);
  });

  it('registers a new user (may fail if email confirmation enforced)', () => {
    cy.visit('/login');
    cy.findByRole('button', { name: /regístrate|crear cuenta/i }).click({ force: true });
    cy.findByPlaceholderText(/correo@ejemplo.com/i).type(email);
    cy.findByPlaceholderText(/••••••••/i).type(password);
    cy.findByRole('button', { name: /crear cuenta|crear mi nexcard/i }).click();
    cy.location('pathname', { timeout: 8000 }).should('match', /edit|login/);
  });
});
