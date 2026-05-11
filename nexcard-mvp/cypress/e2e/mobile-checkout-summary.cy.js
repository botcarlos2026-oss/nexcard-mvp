/// <reference types="cypress" />

describe('Mobile checkout summary', () => {
  beforeEach(() => {
    cy.viewport('iphone-x');
  });

  it('shows mobile order summary details in checkout', () => {
    cy.visit('/preview');
    cy.contains('button', /comprar/i).first().click();
    cy.contains(/catálogo nexcard/i, { timeout: 10000 }).should('exist');

    cy.contains('button', /agregar al carrito/i, { timeout: 10000 }).first().click();
    cy.contains('button', /ver carrito/i, { timeout: 10000 }).click();
    cy.contains('button', /proceder al checkout/i, { timeout: 10000 }).click();

    cy.contains('h3', /tu pedido/i, { timeout: 10000 }).should('exist');
    cy.contains(/subtotal/i).should('exist');
    cy.contains(/envío/i).should('exist');
    cy.contains(/gratis/i).should('exist');
    cy.contains(/total/i).should('exist');
  });
});
