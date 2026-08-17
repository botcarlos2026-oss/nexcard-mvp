Cypress.Commands.add('loginUI', () => {
  const email = Cypress.env('CYPRESS_login_email') || Cypress.env('login_email');
  const password = Cypress.env('CYPRESS_login_password') || Cypress.env('login_password');
  if (!email || !password) {
    throw new Error('Set Cypress login env vars before running tests');
  }

  cy.visit('/login');
  cy.get('[data-cy=auth-email]').type(email, { delay: 5 });
  cy.get('[data-cy=auth-password]').type(password, { log: false });
  cy.get('[data-cy=auth-submit]').click();

  cy.location('pathname', { timeout: 8000 }).should('not.eq', '/login');
  cy.window().then((win) => {
    const stored = JSON.parse(win.localStorage.getItem('nexcard_auth') || 'null');
    expect(stored?.token || stored?.session?.access_token, 'real auth token/session').to.be.a('string').and.not.be.empty;
  });
});

Cypress.Commands.add('logoutUI', () => {
  cy.get('button, a').contains(/cerrar sesión|logout/i).click({ force: true });
});
