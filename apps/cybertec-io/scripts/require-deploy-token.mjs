// Guard for the `deploy` target: fail fast when the Static Web Apps deployment token is
// missing. Without it, `swa deploy` falls back to an interactive login that offers to
// create a new Static Web App, then fails with `project name "undefined"`.
//
// CI sets the token from the `cybertec-io` environment secret (deploy-affected.yml).
// Locally, Nx loads it from `apps/cybertec-io/.env.deploy` for the deploy target only
// (see `.env.deploy.example`).
if (!process.env.SWA_CLI_DEPLOYMENT_TOKEN?.trim()) {
  console.error(
    [
      'SWA_CLI_DEPLOYMENT_TOKEN is not set, so the deploy would target no Static Web App.',
      'Copy apps/cybertec-io/.env.deploy.example to apps/cybertec-io/.env.deploy and fill in',
      'the token (Azure portal: Static Web App > Manage deployment token).'
    ].join('\n')
  );
  process.exit(1);
}
