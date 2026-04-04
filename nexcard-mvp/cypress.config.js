const { defineConfig } = require('cypress');

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
      login_email: 'admin@nexcard.cl', // override via CYPRESS_login_email
      login_password: 'admin123',      // override via CYPRESS_login_password
      supabase_anon_key: process.env.REACT_APP_SUPABASE_ANON_KEY || null,
      supabase_url: process.env.REACT_APP_SUPABASE_URL || null,
    },
  },
});
