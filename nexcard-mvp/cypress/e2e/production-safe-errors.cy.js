/// <reference types="cypress" />

const assertNoRawErrors = () => {
  cy.contains(/Error:|Supabase|service_role|undefined is not|stack trace/i).should('not.exist');
};

describe('Production-safe error contracts', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
  });

  it('shows a clear 404 contract for an unknown public profile on desktop and mobile', () => {
    cy.visit('/slug-inexistente-qa-404');
    cy.contains('Perfil no encontrado', { timeout: 10000 }).should('be.visible');
    cy.contains('Este perfil no existe, fue desactivado o el enlace no es correcto.').should('be.visible');
    cy.contains('a', /Ir a NexCard|Volver al inicio/i).should('have.attr', 'href').and('match', /^\/(preview)?$/);
    cy.screenshot('safe-error-404-desktop');
    assertNoRawErrors();

    cy.viewport(390, 844);
    cy.visit('/slug-inexistente-qa-404');
    cy.contains('Perfil no encontrado', { timeout: 10000 }).should('be.visible');
    cy.get('body').invoke('width').should('be.lte', 430);
    cy.screenshot('safe-error-404-mobile');
  });

  it('shows a clear invalid activation contract without leaking raw backend errors', () => {
    cy.visit('/activar/token-invalido-qa');
    cy.contains('Link de activación inválido o expirado', { timeout: 10000 }).should('be.visible');
    cy.contains('Revisa el enlace o solicita uno nuevo al equipo NexCard.').should('be.visible');
    cy.contains('a', /Volver al inicio/i).should('have.attr', 'href', '/preview');
    cy.screenshot('safe-error-activation');
    assertNoRawErrors();
  });
});
