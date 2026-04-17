/// <reference types="cypress" />

// Covers TC-Orders — Orders Control Center basics

const TABLE_COLUMNS = ['Orden', 'Cliente', 'Monto', 'Pago', 'Fulfillment'];
const DATE_FILTERS = ['Todos', 'Hoy', '7 días', '30 días'];

describe('Admin Orders — Orders Control Center', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginUI();
    cy.visit('/admin/orders');
  });

  it('loads /admin/orders and shows the page title', () => {
    cy.contains('h1', /Orders Control Center/i).should('exist');
  });

  it('shows the expected table columns', () => {
    TABLE_COLUMNS.forEach((column) => {
      cy.contains(column).should('exist');
    });
  });

  it('shows the Actualizar button', () => {
    cy.contains('button', /Actualizar/i).should('exist');
  });

  it('shows the Export CSV button', () => {
    cy.contains('button', /Export CSV/i).should('exist');
  });

  it('shows date range filter options', () => {
    DATE_FILTERS.forEach((filter) => {
      cy.contains(filter).should('exist');
    });
  });
});
