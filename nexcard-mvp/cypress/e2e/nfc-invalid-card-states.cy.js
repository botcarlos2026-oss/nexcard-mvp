/// <reference types="cypress" />

const lifecycleCase = (kind) => ({
  token: Cypress.env(`${kind}_nfc_token`),
  expectedStatus: Number(Cypress.env(`${kind}_http_status`) || 410),
});

describe('NFC invalid card states', () => {
  ['revoked', 'archived'].forEach((kind) => {
    it(`does not resolve a ${kind} card as active profile`, () => {
      const { token, expectedStatus } = lifecycleCase(kind);

      if (!token) {
        throw new Error(`Set CYPRESS_${kind}_nfc_token before running ${kind} NFC guard test`);
      }

      cy.request({
        url: `http://localhost:4000/c/${token}`,
        followRedirect: false,
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(expectedStatus);
      });
    });
  });
});
