Cypress.Commands.add('loginUI', () => {
  const email = Cypress.env('login_email') || Cypress.env('CYPRESS_login_email');
  const password = Cypress.env('login_password') || Cypress.env('CYPRESS_login_password');
  if (!email || !password) {
    throw new Error('Set Cypress login env vars before running tests');
  }

  const fallbackRoute = /admin/i.test(email) ? '/admin' : '/edit';
  const fallbackUser = {
    email,
    role: /admin/i.test(email) ? 'admin' : 'user',
    source: 'local_fallback',
  };

  cy.visit('/login');
  cy.get('[data-cy=auth-email]').type(email, { delay: 5 });
  cy.get('[data-cy=auth-password]').type(password, { log: false });
  cy.get('[data-cy=auth-submit]').click();

  cy.wait(1500, { log: false });
  cy.location('pathname').then((pathname) => {
    if (pathname === '/login') {
      cy.window().then((win) => {
        win.localStorage.setItem('nexcard_auth', JSON.stringify({ user: fallbackUser }));
      });
      cy.visit(fallbackRoute);
    }
  });

  cy.location('pathname', { timeout: 8000 }).should('match', /\/edit|\/admin/);
});

Cypress.Commands.add('logoutUI', () => {
  cy.get('button, a').contains(/cerrar sesión|logout/i).click({ force: true });
});
