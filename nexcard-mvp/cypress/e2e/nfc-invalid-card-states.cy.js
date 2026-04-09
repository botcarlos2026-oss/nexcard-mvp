/// <reference types="cypress" />

describe('NFC invalid card states', () => {
  it('does not resolve a revoked card as active profile', () => {
    const token = Cypress.env('revoked_nfc_token');
    if (!token) {
      throw new Error('Set CYPRESS_revoked_nfc_token before running revoked NFC guard test');
    }

    cy.request({
      url: `http://localhost:4000/c/${token}`,
      followRedirect: false,
      failOnStatusCode: false,
    }).then((response) => {
      expect([404, 410, 409]).to.include(response.status);
    });
  });

  it('does not resolve an archived card as active profile', () => {
    const token = Cypress.env('archived_nfc_token');
    if (!token) {
      throw new Error('Set CYPRESS_archived_nfc_token before running archived NFC guard test');
    }

    cy.request({
      url: `http://localhost:4000/c/${token}`,
      followRedirect: false,
      failOnStatusCode: false,
    }).then((response) => {
      expect([404, 410, 409]).to.include(response.status);
    });
  });
});
