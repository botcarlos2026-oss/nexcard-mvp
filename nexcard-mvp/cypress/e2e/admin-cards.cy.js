/// <reference types="cypress" />

const requiredEnv = (name) => {
  const value = Cypress.env(name);
  if (!value) {
    throw new Error(`Set CYPRESS_${name} before running admin cards lifecycle tests`);
  }
  return value;
};

const getLifecycleFixture = (kind) => ({
  token: requiredEnv(`${kind}_nfc_token`),
  expectedStatus: requiredEnv(`${kind}_expected_status`),
  expectedDeleted: Cypress.env(`${kind}_expected_deleted`) || (kind === 'archived' ? 'Sí' : 'No'),
  expectedCode: Cypress.env(`${kind}_card_code`) || null,
});

const assertCardRow = ({ token, expectedStatus, expectedDeleted, expectedCode }) => {
  cy.contains('[data-cy=admin-cards-table] tbody tr', token, { timeout: 10000 })
    .as('cardRow')
    .should('contain.text', expectedStatus)
    .and('contain.text', expectedDeleted);

  if (expectedCode) {
    cy.get('@cardRow').should('contain.text', expectedCode);
  }
};

describe('Admin cards lifecycle visibility', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginUI();
  });

  it('loads /admin/cards and shows lifecycle columns', () => {
    cy.visit('/admin/cards');
    cy.get('[data-cy=admin-cards-table]').should('exist');
    cy.contains('h1', /Cards Control Center/i).should('exist');

    ['Card', 'Status', 'Activation', 'Profile', 'Deleted', 'Flags'].forEach((column) => {
      cy.get('[data-cy=admin-cards-table]').should('contain.text', column);
    });
  });

  it('shows revoked and archived cards with consistent lifecycle flags', () => {
    const revoked = getLifecycleFixture('revoked');
    const archived = getLifecycleFixture('archived');

    cy.visit('/admin/cards');

    assertCardRow(revoked);
    assertCardRow(archived);
  });

  it('keeps revoked and archived tokens blocked by the public NFC bridge', () => {
    const revoked = getLifecycleFixture('revoked');
    const archived = getLifecycleFixture('archived');

    cy.visit('/admin/cards');
    assertCardRow(revoked);
    assertCardRow(archived);

    [revoked, archived].forEach(({ token }) => {
      cy.request({
        url: `http://localhost:4000/c/${token}`,
        followRedirect: false,
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(410);
      });
    });
  });
});
