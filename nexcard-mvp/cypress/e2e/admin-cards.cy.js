/// <reference types="cypress" />

const requiredEnv = (name) => {
  const value = Cypress.env(name);
  if (!value) {
    throw new Error(`Set CYPRESS_${name} before running admin cards lifecycle tests`);
  }
  return value;
};

const getLifecycleFixture = (kind) => ({
  kind,
  token: requiredEnv(`${kind}_nfc_token`),
  expectedStatus: requiredEnv(`${kind}_expected_status`),
  expectedDeleted: Cypress.env(`${kind}_expected_deleted`) || (kind === 'archived' ? 'Sí' : 'No'),
  expectedCode: Cypress.env(`${kind}_card_code`) || null,
  expectedHttpStatus: Number(Cypress.env(`${kind}_http_status`) || 410),
});

const getCardRow = (token) => cy.contains('[data-cy=admin-cards-table] tbody tr', token, { timeout: 10000 });

const assertCardRow = ({ token, expectedStatus, expectedDeleted, expectedCode }) => {
  getCardRow(token)
    .as('cardRow')
    .should('contain.text', expectedStatus)
    .and('contain.text', expectedDeleted);

  if (expectedCode) {
    cy.get('@cardRow').should('contain.text', expectedCode);
  }
};

const assertActionGuardrails = ({ kind, token, expectedDeleted }) => {
  getCardRow(token).within(() => {
    cy.contains('button', /^Revocar$/i).should(kind === 'revoked' || expectedDeleted === 'Sí' ? 'be.disabled' : 'not.be.disabled');
    cy.contains('button', /^Archivar$/i).should(expectedDeleted === 'Sí' ? 'be.disabled' : 'not.be.disabled');
  });
};

describe('Admin cards lifecycle visibility', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginUI();
    cy.visit('/admin/cards');
    cy.get('[data-cy=admin-cards-table]').should('exist');
  });

  it('loads /admin/cards and shows lifecycle columns', () => {
    cy.contains('h1', /Cards Control Center/i).should('exist');

    ['Tarjeta', 'Estado', 'Activación', 'Perfil', 'Eliminada', 'Alertas', 'Historial', 'Acciones'].forEach((column) => {
      cy.get('[data-cy=admin-cards-table]').should('contain.text', column);
    });
  });

  it('shows revoked and archived cards with consistent lifecycle flags', () => {
    const revoked = getLifecycleFixture('revoked');
    const archived = getLifecycleFixture('archived');

    assertCardRow(revoked);
    assertCardRow(archived);
  });

  it('applies action guardrails consistently for revoked and archived cards', () => {
    const revoked = getLifecycleFixture('revoked');
    const archived = getLifecycleFixture('archived');

    assertCardRow(revoked);
    assertActionGuardrails(revoked);

    assertCardRow(archived);
    assertActionGuardrails(archived);
  });

  it('keeps revoked and archived tokens blocked by the public NFC bridge', () => {
    const revoked = getLifecycleFixture('revoked');
    const archived = getLifecycleFixture('archived');

    [revoked, archived].forEach((card) => {
      assertCardRow(card);

      cy.request({
        url: `http://localhost:4000/c/${card.token}`,
        followRedirect: false,
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(card.expectedHttpStatus);
      });
    });
  });
});
