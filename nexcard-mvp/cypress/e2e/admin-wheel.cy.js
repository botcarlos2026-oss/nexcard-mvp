/// <reference types="cypress" />

// Covers the discount-wheel dashboard at /admin/wheel. Coupons created here
// are validated by create_order_with_items() during real checkout, so a
// broken create/edit flow can hand out invalid or unredeemable discounts.

describe('Admin Wheel — Ruleta de descuentos', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginUI();
    cy.visit('/admin/wheel');
  });

  it('loads /admin/wheel and shows the dashboard title', () => {
    cy.contains('h1', /Ruleta de descuentos/i).should('exist');
  });

  it('shows either existing wheel cards or the empty state', () => {
    cy.contains(/Sin ruletas|premios activos/i, { timeout: 10000 }).should('exist');
    cy.get('body').then(($body) => {
      if (/Sin ruletas/i.test($body.text())) {
        cy.contains('button', /Crear ruleta/i).should('exist');
      }
    });
  });

  it('opens the create-wheel modal with name and prize fields', () => {
    cy.contains('button', /Nueva ruleta/i).click();
    cy.contains('h2', /Crear ruleta/i).should('exist');
    cy.contains('label', /Nombre interno/i).should('exist');
    cy.contains('h3', /Premios/i).should('exist');
    cy.contains('button', /Cancelar/i).click();
    cy.contains('h2', /Crear ruleta/i).should('not.exist');
  });

  it('blocks saving a wheel without a name', () => {
    cy.contains('button', /Nueva ruleta/i).click();
    cy.contains('button', /Guardar ruleta/i).click();
    cy.contains(/El nombre es obligatorio/i).should('exist');
  });
});
