/// <reference types="cypress" />

describe('Checkout field-level errors and submit gating', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.visit('/preview');
    cy.contains('button', /comprar/i).first().click();
    cy.contains('button', /agregar al carrito/i, { timeout: 10000 }).first().click();
    cy.contains('button', /ver carrito/i, { timeout: 10000 }).click();
    cy.contains('button', /proceder al checkout/i).click();
    cy.contains('h1', /checkout/i, { timeout: 10000 }).should('exist');
  });

  it('keeps the submit button disabled until terms are accepted', () => {
    cy.contains('button', /pagar con mercado pago/i).should('be.disabled');
    cy.contains(/acepta los términos.*para activar el pago/i).should('exist');

    cy.get('input[name="acceptTerms"]').check({ force: true });
    cy.contains('button', /pagar con mercado pago/i).should('be.enabled');
  });

  it('marks each empty required field with aria-invalid and an inline message', () => {
    cy.get('input[name="acceptTerms"]').check({ force: true });
    cy.contains('button', /pagar con mercado pago/i).click();

    cy.get('#customerName')
      .should('have.attr', 'aria-invalid', 'true')
      .should('have.attr', 'aria-describedby', 'customerName-error');
    cy.get('#customerName-error').should('contain.text', 'nombre completo');

    cy.get('#customerEmail').should('have.attr', 'aria-invalid', 'true');
    cy.get('#customerEmail-error').should('contain.text', 'email válido');

    cy.get('#customerPhone').should('have.attr', 'aria-invalid', 'true');
    cy.get('#customerAddress').should('have.attr', 'aria-invalid', 'true');
  });

  it('clears a field error as soon as the user fixes that field', () => {
    cy.get('input[name="acceptTerms"]').check({ force: true });
    cy.contains('button', /pagar con mercado pago/i).click();
    cy.get('#customerName').should('have.attr', 'aria-invalid', 'true');

    cy.get('#customerName').type('Carlos QA');
    cy.get('#customerName').should('not.have.attr', 'aria-invalid');
    cy.get('#customerName-error').should('not.exist');
  });

  it('renders the template selector without a user-editable color picker', () => {
    cy.contains(/personaliza tu tarjeta/i).scrollIntoView();
    cy.contains(/plantilla base/i).should('exist');
    cy.contains(/color principal/i).should('not.exist');
    cy.get('input[type="color"]').should('not.exist');
  });
});
