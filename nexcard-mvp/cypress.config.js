const { defineConfig } = require('cypress');

const loginEmail = process.env.CYPRESS_LOGIN_EMAIL || null;
const loginPassword = process.env.CYPRESS_LOGIN_PASSWORD || null;

if (!loginEmail || !loginPassword) {
  throw new Error(
    'Missing E2E environment variables: CYPRESS_LOGIN_EMAIL and CYPRESS_LOGIN_PASSWORD are required.'
  );
}

module.exports = defineConfig({
  video: false,
  screenshotOnRunFailure: true,
  retries: {
    runMode: 1,
    openMode: 0,
  },
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.js',
    env: {
      login_email: loginEmail,
      login_password: loginPassword,
      supabase_anon_key: process.env.REACT_APP_SUPABASE_ANON_KEY || null,
      supabase_url: process.env.REACT_APP_SUPABASE_URL || null,
    },
  },
});
