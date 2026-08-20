/// <reference types="cypress" />

// TC-09 Logout simple

describe('Logout flow', () => {
  it('logs out from header/menu', () => {
    // [data-cy=logout] only exists in the customer-facing UserEditor screen, not in
    // the admin shell that cy.loginUI() lands on — cy.logoutUI() (already defined in
    // cypress/support/commands.js) finds the logout control by text instead, which
    // works for both surfaces.
    cy.loginUI();
    cy.logoutUI();
    cy.location('pathname', { timeout: 8000 }).should('include', '/login');
  });
});
