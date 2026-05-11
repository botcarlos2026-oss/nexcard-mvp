/// <reference types="cypress" />

describe('Public checkout validation', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.visit('/preview');
    cy.contains('button', /comprar/i).first().click();
    cy.contains('button', /agregar al carrito/i, { timeout: 10000 }).first().click();
    cy.contains('button', /ver carrito/i, { timeout: 10000 }).click();
    cy.contains('button', /proceder al checkout/i).click();
    cy.contains('h1', /checkout/i, { timeout: 10000 }).should('exist');
  });

  it('shows required validation errors before submit', () => {
    cy.contains('button', /pagar con mercado pago/i).click();
    cy.contains(/por favor ingresa tu nombre completo/i).should('exist');
  });

  it('requires invoice fields when business invoice is enabled', () => {
    cy.get('input[name="customerName"]').type('Carlos QA');
    cy.get('input[name="customerPhone"]').type('56912345678');
    cy.get('input[name="customerEmail"]').type('qa.checkout@nexcard.cl');
    cy.get('textarea[name="customerAddress"]').type('Av. Apoquindo 1234, Las Condes, Santiago');
    cy.get('input[name="acceptTerms"]').check({ force: true });
    cy.get('input[name="requiresInvoice"]').check({ force: true });

    cy.contains('button', /pagar con mercado pago/i).click();
    cy.contains(/ingresa el rut de la empresa/i).should('exist');

    cy.get('input[name="invoiceRut"]').type('11.111.111-1');
    cy.contains('button', /pagar con mercado pago/i).click();
    cy.contains(/ingresa la razón social de la empresa/i).should('exist');
  });
});
