import {
  provisionKeycloak,
  waitForKeycloakReady,
} from './keycloak-provisioning';

async function main() {
  console.log('Waiting for Keycloak...');
  await waitForKeycloakReady();

  console.log('Provisioning repo-owned realm/client configuration...');
  const provisioned = await provisionKeycloak();

  console.log('Keycloak provisioned:', JSON.stringify(provisioned, null, 2));
}

main().catch((error) => {
  console.error('Keycloak provisioning failed:', error);
  process.exit(1);
});
