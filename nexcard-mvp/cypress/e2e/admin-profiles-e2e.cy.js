/// <reference types="cypress" />

const requiredEnv = (name) => {
  const value = Cypress.env(name);
  if (value === undefined || value === null || value === '') {
    throw new Error(`Set CYPRESS_${name} before running admin profiles end-to-end tests`);
  }
  return value;
};

const getProfileFixture = (kind) => ({
  kind,
  slug: requiredEnv(`${kind}_profile_slug`),
  fullName: Cypress.env(`${kind}_profile_full_name`) || null,
  expectedStatus: requiredEnv(`${kind}_profile_status`),
  expectedDeleted: Cypress.env(`${kind}_profile_deleted`) || (kind === 'archived' ? 'Sí' : 'No'),
  expectedVersions: String(requiredEnv(`${kind}_profile_versions`)),
  expectedLastEvent: requiredEnv(`${kind}_profile_last_event`),
});

const visitAdminProfiles = () => {
  cy.visit('/admin/profiles');
  cy.get('[data-cy=admin-profiles-table]').should('exist');
};

const getProfileRow = (fixture) => cy.contains('[data-cy=admin-profiles-table] tbody tr', fixture.slug, { timeout: 10000 });

describe('Admin profiles end-to-end guardrails', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
  });

  it('keeps public resolution aligned with admin lifecycle visibility for active vs archived profiles', () => {
    const active = getProfileFixture('active');
    const archived = getProfileFixture('archived');

    cy.visit(`/${active.slug}`, { failOnStatusCode: false });
    cy.location('pathname').should('eq', `/${active.slug}`);
    cy.contains(/no pudo cargar el perfil|perfil no encontrado/i, { matchCase: false }).should('not.exist');
    if (active.fullName) {
      cy.contains(active.fullName, { matchCase: false }).should('exist');
    }

    cy.visit(`/${archived.slug}`, { failOnStatusCode: false });
    cy.contains(/no pudo cargar el perfil|perfil no encontrado/i, { matchCase: false }).should('exist');

    cy.loginUI();
    visitAdminProfiles();

    getProfileRow(active)
      .should('contain.text', active.expectedStatus)
      .and('contain.text', active.expectedDeleted)
      .and('contain.text', active.expectedVersions)
      .and('contain.text', active.expectedLastEvent);

    getProfileRow(archived)
      .should('contain.text', archived.expectedStatus)
      .and('contain.text', archived.expectedDeleted)
      .and('contain.text', archived.expectedVersions)
      .and('contain.text', archived.expectedLastEvent);
  });

  it('keeps archived profile discoverable from /admin/profiles after public route rejection', () => {
    const archived = getProfileFixture('archived');

    cy.visit(`/${archived.slug}`, { failOnStatusCode: false });
    cy.contains(/no pudo cargar el perfil|perfil no encontrado/i, { matchCase: false }).should('exist');

    cy.loginUI();
    visitAdminProfiles();

    cy.get('input[placeholder*="slug"]').clear().type(archived.slug);
    getProfileRow(archived)
      .should('contain.text', archived.expectedStatus)
      .and('contain.text', archived.expectedDeleted)
      .and('contain.text', archived.expectedVersions)
      .and('contain.text', archived.expectedLastEvent)
      .find('[title="Archivado"]')
      .should('exist');

    cy.get('select').select('archived');
    getProfileRow(archived).should('exist');
  });
});
