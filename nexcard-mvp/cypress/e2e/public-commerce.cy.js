/// <reference types="cypress" />

describe('Public commerce flow', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
  });

  it('landing preview loads and CTA Comprar opens catalog', () => {
    cy.visit('/preview');
    cy.contains(/nexcard/i).should('exist');
    cy.contains('button', /comprar/i).first().click();
    cy.contains(/catálogo nexcard/i, { timeout: 10000 }).should('exist');
  });

  it('catalog renders at least one product card', () => {
    cy.visit('/preview');
    cy.contains('button', /comprar/i).first().click();
    cy.contains(/catálogo nexcard/i, { timeout: 10000 }).should('exist');
    cy.contains(/agregar al carrito/i, { timeout: 10000 }).should('exist');
  });
});
