Cypress.Commands.add('loginUI', () => {
  const email = Cypress.env('login_email');
  const password = Cypress.env('login_password');
  if (!email || !password) {
    throw new Error('Set CYPRESS_login_email and CYPRESS_login_password env vars before running tests');
  }

  cy.visit('/login');
  cy.get('[data-cy=auth-email]').type(email, { delay: 5 });
  cy.get('[data-cy=auth-password]').type(password, { log: false });
  cy.get('[data-cy=auth-submit]').click();
  cy.location('pathname', { timeout: 8000 }).should('match', /\/edit|\/admin/);
});

Cypress.Commands.add('logoutUI', () => {
  cy.get('button, a').contains(/cerrar sesión|logout/i).click({ force: true });
});
