/// <reference types="cypress" />

describe('Public checkout entry flow', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
  });

  it('user can add a product, open cart, and reach checkout', () => {
    cy.visit('/preview');
    cy.contains('button', /comprar/i).first().click();
    cy.contains(/catálogo nexcard/i, { timeout: 10000 }).should('exist');

    cy.contains('button', /agregar al carrito/i, { timeout: 10000 }).first().click();
    cy.contains('button', /ver carrito/i, { timeout: 10000 }).click();

    cy.contains(/carrito/i, { timeout: 10000 }).should('exist');
    cy.contains('button', /proceder al checkout/i).click();

    cy.contains('h1', /checkout/i, { timeout: 10000 }).should('exist');
    cy.contains(/datos de contacto/i, { timeout: 10000 }).should('exist');
    cy.contains(/mercado pago/i, { timeout: 10000 }).should('exist');
  });
});
