/// <reference types="cypress" />

describe('NFC bridge', () => {
  it('redirects a live token to a public profile route', () => {
    const token = Cypress.env('nfc_token');
    const expectedSlug = Cypress.env('nfc_expected_slug');

    if (!token || !expectedSlug) {
      throw new Error('Set CYPRESS_nfc_token and CYPRESS_nfc_expected_slug before running NFC bridge test');
    }

    cy.request({
      url: `http://localhost:4000/c/${token}`,
      followRedirect: false,
      failOnStatusCode: false,
    }).then((response) => {
      expect([301, 302]).to.include(response.status);
      expect(response.redirectedToUrl || response.headers.location).to.include(expectedSlug);
    });
  });
});
