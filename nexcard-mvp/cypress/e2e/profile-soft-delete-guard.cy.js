/// <reference types="cypress" />

describe('Profile soft delete guardrails', () => {
  it('public route for a deleted profile should not resolve as active profile', () => {
    const deletedSlug = Cypress.env('deleted_profile_slug');

    if (!deletedSlug) {
      throw new Error('Set CYPRESS_deleted_profile_slug before running deleted profile guard test');
    }

    cy.visit(`/${deletedSlug}`, { failOnStatusCode: false });
    cy.contains(/no pudo cargar el perfil|perfil no encontrado/i, { matchCase: false }).should('exist');
  });
});
