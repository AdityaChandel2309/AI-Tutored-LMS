import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import axios from 'axios';
import { loadProjectEnv } from '../env';
import {
  getFrontendAppUrl,
  getKeycloakClientId,
  getKeycloakInternalUrl,
  getKeycloakRealm,
  getKeycloakRedirectUri,
} from '../config/runtime';

type ProvisionConfig = {
  realm: string;
  enabled: boolean;
  client: {
    clientId: string;
    publicClient: boolean;
    directAccessGrantsEnabled: boolean;
    standardFlowEnabled: boolean;
    serviceAccountsEnabled: boolean;
  };
  roles: string[];
  redirectUris: string[];
  webOrigins: string[];
};

function loadProvisionConfig() {
  const repoConfigPath = resolve(
    process.cwd(),
    '../keycloak/realm-config.json',
  );
  const localConfigPath = resolve(process.cwd(), 'keycloak/realm-config.json');
  const configPath = existsSync(repoConfigPath)
    ? repoConfigPath
    : localConfigPath;

  if (!existsSync(configPath)) {
    throw new Error(`Missing Keycloak config at ${configPath}`);
  }

  return JSON.parse(readFileSync(configPath, 'utf8')) as ProvisionConfig;
}

function withEnvOverrides(config: ProvisionConfig) {
  const frontendAppUrl = getFrontendAppUrl();
  const redirectUri = getKeycloakRedirectUri();
  const keycloakRealm = getKeycloakRealm();
  const keycloakClientId = getKeycloakClientId();

  const webOrigins = Array.from(
    new Set([...config.webOrigins, frontendAppUrl]),
  );
  const redirectUris = Array.from(
    new Set([...config.redirectUris, redirectUri]),
  );

  return {
    ...config,
    realm: keycloakRealm,
    client: {
      ...config.client,
      clientId: keycloakClientId,
    },
    redirectUris,
    webOrigins,
  };
}

export async function waitForKeycloakReady(baseUrl = getKeycloakInternalUrl()) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    try {
      const response = await axios.get(
        `${baseUrl}/realms/master/.well-known/openid-configuration`,
      );

      if (response.status === 200) {
        return;
      }
    } catch {
      // Retry until Keycloak is available.
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 2000));
  }

  throw new Error('Keycloak did not become ready in time');
}

export async function getKeycloakAdminToken() {
  const adminRealm = process.env.KEYCLOAK_ADMIN_REALM ?? 'master';
  const adminClientId = process.env.KEYCLOAK_ADMIN_CLIENT_ID ?? 'admin-cli';
  const adminUsername = process.env.KEYCLOAK_ADMIN_USER ?? 'admin';
  const adminPassword = process.env.KEYCLOAK_ADMIN_PASSWORD ?? 'admin123';

  const params = new URLSearchParams();
  params.append('grant_type', 'password');
  params.append('client_id', adminClientId);
  params.append('username', adminUsername);
  params.append('password', adminPassword);

  const response = await axios.post<{
    access_token: string;
  }>(
    `${getKeycloakInternalUrl()}/realms/${adminRealm}/protocol/openid-connect/token`,
    params,
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    },
  );

  return response.data.access_token;
}

export async function provisionKeycloak() {
  loadProjectEnv();

  const baseConfig = loadProvisionConfig();
  const config = withEnvOverrides(baseConfig);
  const adminToken = await getKeycloakAdminToken();
  const keycloakBaseUrl = getKeycloakInternalUrl();
  const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET;

  if (!clientSecret) {
    throw new Error('KEYCLOAK_CLIENT_SECRET is required for provisioning');
  }

  await ensureRealm({
    keycloakBaseUrl,
    adminToken,
    config,
  });
  const resolvedClientSecret = await ensureClient({
    keycloakBaseUrl,
    adminToken,
    config,
    clientSecret,
  });

  for (const roleName of config.roles) {
    await ensureRealmRole({
      keycloakBaseUrl,
      adminToken,
      realm: config.realm,
      roleName,
    });
  }

  return {
    realm: config.realm,
    clientId: config.client.clientId,
    clientSecret: resolvedClientSecret,
    redirectUris: config.redirectUris,
    webOrigins: config.webOrigins,
    roles: config.roles,
  };
}

async function ensureRealm(input: {
  keycloakBaseUrl: string;
  adminToken: string;
  config: ProvisionConfig;
}) {
  const { keycloakBaseUrl, adminToken, config } = input;

  try {
    await axios.get(`${keycloakBaseUrl}/admin/realms/${config.realm}`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
  } catch {
    await axios.post(
      `${keycloakBaseUrl}/admin/realms`,
      {
        realm: config.realm,
        enabled: config.enabled,
      },
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      },
    );
  }
}

async function ensureClient(input: {
  keycloakBaseUrl: string;
  adminToken: string;
  config: ProvisionConfig;
  clientSecret: string;
}) {
  const { keycloakBaseUrl, adminToken, config, clientSecret } = input;

  const clientResponse = await axios.get<
    Array<{ id: string; clientId: string }>
  >(`${keycloakBaseUrl}/admin/realms/${config.realm}/clients`, {
    params: {
      clientId: config.client.clientId,
    },
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });

  let clientId = clientResponse.data[0]?.id;
  const clientPayload = {
    id: clientId,
    clientId: config.client.clientId,
    enabled: config.enabled,
    publicClient: config.client.publicClient,
    directAccessGrantsEnabled: config.client.directAccessGrantsEnabled,
    standardFlowEnabled: config.client.standardFlowEnabled,
    serviceAccountsEnabled: config.client.serviceAccountsEnabled,
    secret: clientSecret,
    redirectUris: config.redirectUris,
    webOrigins: config.webOrigins,
  };

  if (!clientId) {
    await axios.post(
      `${keycloakBaseUrl}/admin/realms/${config.realm}/clients`,
      clientPayload,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      },
    );

    const createdClientResponse = await axios.get<
      Array<{ id: string; clientId: string }>
    >(`${keycloakBaseUrl}/admin/realms/${config.realm}/clients`, {
      params: {
        clientId: config.client.clientId,
      },
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    clientId = createdClientResponse.data[0]?.id;
  } else {
    await axios.put(
      `${keycloakBaseUrl}/admin/realms/${config.realm}/clients/${clientId}`,
      clientPayload,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      },
    );
  }

  if (!clientId) {
    throw new Error('Failed to resolve Keycloak client during provisioning');
  }

  const secretResponse = await axios.get<{
    value: string;
  }>(
    `${keycloakBaseUrl}/admin/realms/${config.realm}/clients/${clientId}/client-secret`,
    {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    },
  );

  return secretResponse.data.value;
}

async function ensureRealmRole(input: {
  keycloakBaseUrl: string;
  adminToken: string;
  realm: string;
  roleName: string;
}) {
  const { keycloakBaseUrl, adminToken, realm, roleName } = input;

  try {
    await axios.get(
      `${keycloakBaseUrl}/admin/realms/${realm}/roles/${roleName}`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      },
    );
  } catch {
    await axios.post(
      `${keycloakBaseUrl}/admin/realms/${realm}/roles`,
      {
        name: roleName,
      },
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      },
    );
  }
}
