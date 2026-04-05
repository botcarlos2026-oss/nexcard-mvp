/// <reference types="cypress" />

// Covers TC-03: Editar perfil

describe('Editor de Perfil', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginUI();
    cy.visit('/edit');
    cy.contains(/Básico/i).click();
  });

  it('edits basic fields and saves', () => {
    cy.get('[data-cy=profile-name]').clear().type('Carlos Alvarez QA');
    cy.get('[data-cy=save-profile]').click();
    cy.contains(/cambios guardados/i, { matchCase: false }).should('exist');
  });

  it('toggles bank section', () => {
    cy.contains(/Pago/i).click();
    cy.get('[data-cy=bank-toggle]').click({ force: true });
    cy.contains(/Datos bancarios|Banco/i).should('exist');
  });
});
