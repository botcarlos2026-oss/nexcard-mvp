/// <reference types="cypress" />

// Covers TC-Orders — Centro de órdenes basics
const DATE_FILTERS = ['Todos', 'Hoy', '7 días', '30 días'];

describe('Admin Orders — Centro de órdenes', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginUI();
    cy.visit('/admin/orders');
  });

  it('loads /admin/orders and shows the page title', () => {
    cy.contains('h1', /Centro de órdenes/i).should('exist');
  });

  it('shows Kanban-first operational sections', () => {
    cy.get('[data-cy=orders-kanban-board]').should('exist');
    cy.contains(/Próxima acción|Sin pendientes/i).should('exist');
    cy.contains(/Resumen operativo/i).should('exist');
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
