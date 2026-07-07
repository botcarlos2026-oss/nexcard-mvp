/// <reference types="cypress" />
/* global cy, Cypress */

// Smoke covering public routing by default, plus auth/admin when seeded creds exist.

describe('NexCard smoke flow', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
  });

  it('coming soon home loads', () => {
    cy.visit('/');
    cy.contains(/NexCard/i).should('exist');
  });

  it('preview landing loads', () => {
    cy.visit('/preview');
    cy.contains(/NexCard/i).should('exist');
    cy.contains(/tarjeta|digital|contacto|comprar|checkout/i).should('exist');
  });

  it('legal pages load', () => {
    cy.visit('/privacidad');
    cy.contains(/privacidad|datos personales/i).should('exist');
    cy.visit('/terminos');
    cy.contains(/términos|condiciones/i).should('exist');
  });

  it('public profile route renders a contact profile', () => {
    const slug = Cypress.env('public_profile_slug') || 'carlos-alvarez';
    cy.visit(`/${slug}`);
    cy.contains(/guardar contacto|whatsapp|llamar|sitio web/i, { timeout: 10000 }).should('exist');
  });

  const runAuthSmoke = String(Cypress.env('smoke_auth') || '').toLowerCase() === 'true';

  (runAuthSmoke ? it : it.skip)('login via UI and reach /edit or /admin', () => {
    cy.loginUI();
    cy.location('pathname', { timeout: 10000 }).should('match', /\/edit|\/admin/);
  });

  (runAuthSmoke ? it : it.skip)('admin profiles dataset loads', () => {
    cy.loginUI();
    cy.visit('/admin/profiles');
    cy.get('[data-cy=admin-profiles-table]', { timeout: 15000 }).should('exist');
  });

  (runAuthSmoke ? it : it.skip)('admin orders Kanban route exposes operational lanes', () => {
    cy.loginUI();
    cy.visit('/admin/orders');
    cy.get('[data-cy=orders-kanban-board]', { timeout: 15000 }).should('exist');
    [
      'paid_new',
      'in_production',
      'ready_to_ship',
      'shipped_pending_delivery',
      'delivered',
      'alerts',
    ].forEach((lane) => {
      cy.get(`[data-cy=orders-kanban-lane-${lane}]`).should('exist');
    });
  });
});
