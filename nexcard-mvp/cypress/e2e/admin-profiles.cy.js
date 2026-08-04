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

const cssEscape = (value) => {
  return String(value).replace(/[\\"]/g, '\\$&');
};

const getProfileRow = (fixture) => cy.get(`[data-cy="admin-profiles-row-${cssEscape(fixture.slug)}"]`, { timeout: 10000 });

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

    ['Profile', 'Status', 'Deleted', 'Versions', 'Snapshot / Restore', 'Last Event', 'Updated', 'Actions'].forEach((column) => {
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

    cy.get('[data-cy=admin-profiles-search]').clear().type(archived.slug);
    getProfileRow(archived).should('exist');
    getProfileRow(active).should('not.exist');

    cy.get('[data-cy=admin-profiles-search]').clear();
    cy.get('[data-cy=admin-profiles-status-filter]').select('archived');
    getProfileRow(archived).should('exist').and('contain.text', archived.expectedDeleted);
    getProfileRow(active).should('not.exist');
  });

  it('keeps history/archive visual guardrails visible after filter changes', () => {
    const archived = getProfileFixture('archived');

    cy.get('[data-cy=admin-profiles-status-filter]').select('archived');
    assertProfileRow(archived);
    getProfileRow(archived)
      .find('[title="Tiene historial"]')
      .should('exist');
    getProfileRow(archived)
      .find('[title="Archivado"]')
      .should('exist');

    cy.get('[data-cy=admin-profiles-status-filter]').select('all');
    assertProfileRow(archived);
  });
});
