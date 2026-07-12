# Security Notes

## Temporary dependency audit exception

`npm audit` currently reports vulnerabilities inherited mainly through `react-scripts@5.0.1` and its locked build/test toolchain (`webpack-dev-server`, `svgo`, `serialize-javascript`, `workbox-*`, Jest/jsdom chain). The audit-proposed remediation requires replacing/downgrading `react-scripts` rather than a safe patch-level update, so no dependency override is applied in this hardening pass.

Short-term isolation measures:

- Do not expose `react-scripts start` or webpack dev server publicly; use local development only.
- Production deploys use static build artifacts, not the dev server.
- Treat SVG/CSS/build inputs as trusted repository-controlled assets only.
- Keep CI/build secrets out of frontend build-time inputs and logs.
- Revisit this exception when migrating from `react-scripts` to a maintained build stack such as Vite or Next.js.
