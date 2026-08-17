/// <reference types="cypress" />

// Covers Products/Pricing dashboard at /admin/products.
// Prices set here feed directly into public checkout totals — a render
// crash or broken save here would let stale/wrong prices reach customers.

describe('Admin Products — Planes y precios', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginUI();
    cy.visit('/admin/products');
  });

  it('loads /admin/products and shows the dashboard title', () => {
    cy.contains('h1', /Planes y precios/i).should('exist');
  });

  it('shows the products table with pricing columns or the empty state', () => {
    cy.contains(/No hay productos|SKU/i, { timeout: 10000 }).should('exist');
    cy.get('body').then(($body) => {
      if ($body.find('table').length > 0) {
        ['SKU', 'Nombre', 'Precio', 'Estado'].forEach((column) => {
          cy.contains('th', column).should('exist');
        });
      }
    });
  });

  it('shows the stats row (total, activos, inactivos, precio promedio)', () => {
    ['Total productos', 'Activos', 'Inactivos', 'Precio promedio'].forEach((label) => {
      cy.contains(label).should('exist');
    });
  });

  it('opens the new product modal with SKU and price fields', () => {
    cy.contains('button', /Nuevo producto/i).click();
    cy.contains('h2', /Nuevo producto/i).should('exist');
    cy.contains('label', /SKU/i).should('exist');
    cy.contains('label', /Precio CLP/i).should('exist');
    cy.contains('button', /Cancelar/i).click();
    cy.contains('h2', /Nuevo producto/i).should('not.exist');
  });

  it('validates a bad SKU/price instead of silently saving', () => {
    cy.contains('button', /Nuevo producto/i).click();
    cy.contains('button', /Crear producto/i).click();
    cy.contains(/SKU requerido/i).should('exist');
    cy.contains(/Precio mínimo/i).should('exist');
  });
});
