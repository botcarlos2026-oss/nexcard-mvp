/// <reference types="cypress" />

// Covers Inventory dashboard at /admin/inventory. Stock levels here decide
// whether an order can be fulfilled — a broken register-movement flow means
// stock silently drifts from reality.

describe('Admin Inventory — Inventario y Logística', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginUI();
    cy.visit('/admin/inventory');
  });

  it('loads /admin/inventory and shows the dashboard title', () => {
    cy.contains('h1', /Inventario y Log[ií]stica/i).should('exist');
  });

  it('shows the stock table with quantity columns', () => {
    ['Item', 'SKU', 'Stock Actual', 'Stock mín.', 'Estado'].forEach((column) => {
      cy.contains('th', column).should('exist');
    });
  });

  it('opens the register-movement modal with type/quantity/reason fields', () => {
    cy.contains('button', /Registrar Movimiento/i).click();
    cy.contains('h3', /Registrar movimiento/i).should('exist');
    cy.contains('span', /^Tipo$/i).should('exist');
    cy.contains('span', /^Cantidad$/i).should('exist');
    cy.contains('span', /^Motivo$/i).should('exist');
    cy.contains('button', /Cancelar/i).click();
    cy.contains('h3', /Registrar movimiento/i).should('not.exist');
  });

  it('offers in/out/adjust movement types', () => {
    cy.contains('button', /Registrar Movimiento/i).click();
    cy.contains('span', /^Tipo$/i).parent().within(() => {
      cy.get('select').should('contain.text', 'Entrada')
        .and('contain.text', 'Salida')
        .and('contain.text', 'Ajuste');
    });
  });
});
