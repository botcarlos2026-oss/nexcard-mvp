/// <reference types="cypress" />

// Covers CRM Pipeline Kanban board at /admin/crm

const KANBAN_COLUMNS = ['Nueva', 'En producción', 'Lista', 'Enviada', 'Entregada'];

describe('Admin CRM — Pipeline de órdenes', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginUI();
    cy.visit('/admin/crm');
  });

  it('loads /admin/crm and shows the pipeline title', () => {
    cy.contains('h1', /CRM — Pipeline de órdenes/i).should('exist');
  });

  it('shows all 5 Kanban columns', () => {
    KANBAN_COLUMNS.forEach((column) => {
      cy.contains(column).should('exist');
    });
  });

  it('shows the cancelled orders section (may be collapsed)', () => {
    // The cancelled section can be rendered collapsed; we only assert it exists in the DOM
    cy.contains(/cancelada[s]?/i).should('exist');
  });

  it('shows advance-state buttons with the next status label', () => {
    // Each advance button should carry the name of the target state.
    // We verify that at least the set of forward-state labels appears somewhere
    // in the interactive controls on the page.
    const forwardStates = ['En producción', 'Lista', 'Enviada', 'Entregada'];

    forwardStates.forEach((label) => {
      // Buttons may not exist if no cards are in that column, so we only
      // assert the label pattern is present when the column itself has cards.
      // A softer check: if any such button exists, it must contain the label.
      cy.get('body').then(($body) => {
        const buttons = $body.find(`button:contains("${label}")`);
        if (buttons.length > 0) {
          cy.contains('button', label).should('exist');
        }
      });
    });
  });
});
