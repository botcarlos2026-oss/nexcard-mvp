/// <reference types="cypress" />

// Covers TC-03: Editar perfil

describe('Editor de Perfil', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginUI();
    cy.visit('/edit');
  });

  it('edits basic fields and saves', () => {
    cy.findByLabelText(/nombre/i).clear().type('Carlos Alvarez QA');
    cy.contains(/guardar/i).click();
    cy.contains(/cambios guardados/i, { matchCase: false }).should('exist');
  });

  it('toggles bank section', () => {
    cy.contains(/Pago/i).click();
    cy.get('input[type="checkbox"],button[role="switch"],label:contains("banc")').first().click({ force: true });
    cy.contains(/Datos bancarios|Banco/i).should('exist');
  });
});
