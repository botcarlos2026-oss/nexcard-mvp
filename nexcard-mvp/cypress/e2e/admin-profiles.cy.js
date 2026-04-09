/// <reference types="cypress" />

const requiredEnv = (name) => {
  const value = Cypress.env(name);
  if (value === undefined || value === null || value === '') {
    throw new Error(`Set CYPRESS_${name} before running admin profiles guardrail tests`);
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

const getProfileRow = (fixture) => cy.contains('[data-cy=admin-profiles-table] tbody tr', fixture.slug, { timeout: 10000 });

const assertProfileRow = (fixture) => {
  getProfileRow(fixture)
    .as(`${fixture.kind}ProfileRow`)
    .should('contain.text', fixture.slug)
    .and('contain.text', fixture.expectedStatus)
    .and('contain.text', fixture.expectedDeleted)
    .and('contain.text', fixture.expectedVersions)
    .and('contain.text', fixture.expectedLastEvent);

  if (fixture.fullName) {
    cy.get(`@${fixture.kind}ProfileRow`).should('contain.text', fixture.fullName);
  }
};

const visitAdminProfiles = () => {
  cy.visit('/admin/profiles');
  cy.get('[data-cy=admin-profiles-table]').should('exist');
};

describe('Admin profiles lifecycle/history visibility', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginUI();
    visitAdminProfiles();
  });

  it('loads /admin/profiles and shows lifecycle/history columns', () => {
    cy.contains('h1', /Profiles Recovery Desk/i).should('exist');

    ['Profile', 'Status', 'Deleted', 'Versions', 'Last Event', 'Updated', 'Flags'].forEach((column) => {
      cy.get('[data-cy=admin-profiles-table]').should('contain.text', column);
    });
  });

  it('shows seeded active and archived profiles with consistent lifecycle/history metadata', () => {
    const active = getProfileFixture('active');
    const archived = getProfileFixture('archived');

    assertProfileRow(active);
    assertProfileRow(archived);
  });

  it('filters reproducibly by search term and archived status', () => {
    const active = getProfileFixture('active');
    const archived = getProfileFixture('archived');

    cy.get('input[placeholder*="slug"]').clear().type(archived.slug);
    getProfileRow(archived).should('exist');
    cy.contains('[data-cy=admin-profiles-table] tbody tr', active.slug).should('not.exist');

    cy.get('input[placeholder*="slug"]').clear();
    cy.get('select').select('archived');
    getProfileRow(archived).should('exist').and('contain.text', archived.expectedDeleted);
    cy.contains('[data-cy=admin-profiles-table] tbody tr', active.slug).should('not.exist');
  });

  it('keeps history/archive visual guardrails visible after filter changes', () => {
    const archived = getProfileFixture('archived');

    cy.get('select').select('archived');
    assertProfileRow(archived);
    cy.contains('[data-cy=admin-profiles-table] tbody tr', archived.slug)
      .find('[title="Tiene historial"]')
      .should('exist');
    cy.contains('[data-cy=admin-profiles-table] tbody tr', archived.slug)
      .find('[title="Archivado"]')
      .should('exist');

    cy.get('select').select('all');
    assertProfileRow(archived);
  });
});
