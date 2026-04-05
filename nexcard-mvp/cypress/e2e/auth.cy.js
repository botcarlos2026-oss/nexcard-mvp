/// <reference types="cypress" />

// TC-01 Login / TC-02 Registro básico (registro en staging puede requerir correo real)

describe('Auth flows', () => {
  const email = `qa+${Date.now()}@example.com`;
  const password = 'Test12345!';

  it('login with existing admin user (from env)', () => {
    cy.loginUI();
    cy.location('pathname').should('match', /edit|admin/);
  });

  // Registro se omite en staging: Supabase puede requerir confirmación de correo
});
