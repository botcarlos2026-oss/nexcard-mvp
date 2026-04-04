import '@testing-library/cypress/add-commands';
import './commands';

Cypress.on('uncaught:exception', (err) => {
  // Prevent React hydration warnings from failing the run
  if (err.message && err.message.includes('Hydration failed')) {
    return false;
  }
  return true;
});
