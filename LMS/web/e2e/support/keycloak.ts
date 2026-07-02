import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  id_token: string;
};

type KeycloakUser = {
  id: string;
  username: string;
};

type KeycloakRole = {
  id: string;
  name: string;
};

type EnvShape = {
  keycloakBaseUrl: string;
  keycloakRealm: string;
  keycloakAdminRealm: string;
  keycloakClientId: string;
  keycloakClientSecret: string;
  adminUsername: string;
  adminPassword: string;
  appUrl: string;
};

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");

  for (const line of content.split("\n")) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");

    if (separatorIndex < 0) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^"(.*)"$/, "$1");

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), "../api/.env"));
loadEnvFile(resolve(process.cwd(), "../.env"));

function getEnv(): EnvShape {
  return {
    keycloakBaseUrl:
      process.env.NEXT_PUBLIC_KEYCLOAK_URL ??
      process.env.KEYCLOAK_BASE_URL ??
      "http://localhost:8080",
    keycloakRealm:
      process.env.NEXT_PUBLIC_KEYCLOAK_REALM ??
      process.env.KEYCLOAK_REALM ??
      "LMS",
    keycloakAdminRealm:
      process.env.KEYCLOAK_ADMIN_REALM ?? "master",
    keycloakClientId:
      process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID ??
      process.env.KEYCLOAK_CLIENT_ID ??
      "lms-web",
    keycloakClientSecret:
      process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_SECRET ??
      process.env.KEYCLOAK_CLIENT_SECRET ??
      "",
    adminUsername:
      process.env.KEYCLOAK_ADMIN_USER ?? "admin",
    adminPassword:
      process.env.KEYCLOAK_ADMIN_PASSWORD ?? "admin123",
    appUrl:
      process.env.NEXT_PUBLIC_APP_URL ??
      "http://127.0.0.1:3001",
  };
}

async function fetchJson<T>(
  input: string,
  init?: RequestInit,
) {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw new Error(
      `Request failed: ${response.status} ${response.statusText}`,
    );
  }

  const text = await response.text();

  if (!text) {
    return null as T;
  }

  return JSON.parse(text) as T;
}

async function waitForKeycloakReady(baseUrl: string) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    try {
      const response = await fetch(
        `${baseUrl}/realms/master/.well-known/openid-configuration`,
      );

      if (response.ok) {
        return;
      }
    } catch {
      // Retry until Keycloak is reachable.
    }

    await new Promise((resolveDelay) =>
      setTimeout(resolveDelay, 2000),
    );
  }

  throw new Error("Keycloak did not become ready in time");
}

async function getAdminToken(env: EnvShape) {
  const params = new URLSearchParams({
    grant_type: "password",
    client_id: "admin-cli",
    username: env.adminUsername,
    password: env.adminPassword,
  });

  const response = await fetchJson<{ access_token: string }>(
    `${env.keycloakBaseUrl}/realms/${env.keycloakAdminRealm}/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    },
  );

  return response.access_token;
}

async function ensureRealm(
  env: EnvShape,
  adminToken: string,
) {
  const realmUrl = `${env.keycloakBaseUrl}/admin/realms/${env.keycloakRealm}`;
  const response = await fetch(realmUrl, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });

  if (response.ok) {
    return;
  }

  await fetchJson(
    `${env.keycloakBaseUrl}/admin/realms`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        realm: env.keycloakRealm,
        enabled: true,
      }),
    },
  );
}

async function ensureClient(
  env: EnvShape,
  adminToken: string,
) {
  const searchUrl =
    `${env.keycloakBaseUrl}/admin/realms/${env.keycloakRealm}/clients` +
    `?clientId=${encodeURIComponent(env.keycloakClientId)}`;

  const existingClients = await fetchJson<
    Array<{ id: string; clientId: string }>
  >(searchUrl, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });

  let clientId = existingClients[0]?.id;
  const clientBody = {
    id: clientId,
    clientId: env.keycloakClientId,
    enabled: true,
    publicClient: false,
    directAccessGrantsEnabled: true,
    standardFlowEnabled: true,
    serviceAccountsEnabled: false,
    secret: env.keycloakClientSecret,
    redirectUris: ["http://localhost:3001/callback"],
    webOrigins: ["http://localhost:3001", "http://127.0.0.1:3001"],
  };

  if (!clientId) {
    const createResponse = await fetch(
      `${env.keycloakBaseUrl}/admin/realms/${env.keycloakRealm}/clients`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(clientBody),
      },
    );

    if (!createResponse.ok && createResponse.status !== 409) {
      throw new Error(
        `Request failed: ${createResponse.status} ${createResponse.statusText}`,
      );
    }

    const createdClients = await fetchJson<
      Array<{ id: string; clientId: string }>
    >(searchUrl, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    clientId = createdClients[0]?.id;
  } else {
    const updateResponse = await fetch(
      `${env.keycloakBaseUrl}/admin/realms/${env.keycloakRealm}/clients/${clientId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(clientBody),
      },
    );

    if (!updateResponse.ok && updateResponse.status !== 409) {
      throw new Error(
        `Request failed: ${updateResponse.status} ${updateResponse.statusText}`,
      );
    }
  }

  if (!clientId) {
    throw new Error("Failed to resolve Keycloak client");
  }

  const secretResponse = await fetchJson<{ value: string }>(
    `${env.keycloakBaseUrl}/admin/realms/${env.keycloakRealm}/clients/${clientId}/client-secret`,
    {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    },
  );

  return secretResponse.value;
}

async function ensureRealmRole(
  env: EnvShape,
  adminToken: string,
  roleName: string,
) {
  const roleUrl =
    `${env.keycloakBaseUrl}/admin/realms/${env.keycloakRealm}/roles/${roleName}`;
  const existingResponse = await fetch(roleUrl, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });

  if (existingResponse.ok) {
    return;
  }

  await fetchJson(
    `${env.keycloakBaseUrl}/admin/realms/${env.keycloakRealm}/roles`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: roleName }),
    },
  );
}

async function getRealmRole(
  env: EnvShape,
  adminToken: string,
  roleName: string,
) {
  return fetchJson<KeycloakRole>(
    `${env.keycloakBaseUrl}/admin/realms/${env.keycloakRealm}/roles/${roleName}`,
    {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    },
  );
}

async function ensureUser(
  env: EnvShape,
  adminToken: string,
  input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  },
) {
  const lookupUrl =
    `${env.keycloakBaseUrl}/admin/realms/${env.keycloakRealm}/users` +
    `?username=${encodeURIComponent(input.email)}`;
  const existingUsers = await fetchJson<KeycloakUser[]>(
    lookupUrl,
    {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    },
  );

  const existingUser = existingUsers.find(
    (user) => user.username === input.email,
  );

  if (existingUser) {
    await fullySetupUser(
      env,
      adminToken,
      existingUser.id,
      input,
    );

    return existingUser.id;
  }

  await fetchJson(
    `${env.keycloakBaseUrl}/admin/realms/${env.keycloakRealm}/users`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: input.email,
        username: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        enabled: true,
        emailVerified: true,
        credentials: [
          {
            type: "password",
            value: input.password,
            temporary: false,
          },
        ],
      }),
    },
  );

  const createdUsers = await fetchJson<KeycloakUser[]>(
    lookupUrl,
    {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    },
  );
  const createdUser = createdUsers.find(
    (user) => user.username === input.email,
  );

  if (!createdUser) {
    throw new Error("Failed to create Keycloak user");
  }

  return createdUser.id;
}

async function fullySetupUser(
  env: EnvShape,
  adminToken: string,
  userId: string,
  input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  },
) {
  await fetchJson(
    `${env.keycloakBaseUrl}/admin/realms/${env.keycloakRealm}/users/${userId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: userId,
        email: input.email,
        username: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        enabled: true,
        emailVerified: true,
      }),
    },
  );

  await fetchJson(
    `${env.keycloakBaseUrl}/admin/realms/${env.keycloakRealm}/users/${userId}/reset-password`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "password",
        value: input.password,
        temporary: false,
      }),
    },
  );
}

async function assignRealmRoles(
  env: EnvShape,
  adminToken: string,
  userId: string,
  roles: string[],
) {
  const currentRoles = await fetchJson<KeycloakRole[]>(
    `${env.keycloakBaseUrl}/admin/realms/${env.keycloakRealm}/users/${userId}/role-mappings/realm`,
    {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    },
  );
  const targetRoles = await Promise.all(
    roles.map((roleName) =>
      getRealmRole(env, adminToken, roleName),
    ),
  );

  if (currentRoles.length > 0) {
    await fetchJson(
      `${env.keycloakBaseUrl}/admin/realms/${env.keycloakRealm}/users/${userId}/role-mappings/realm`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(currentRoles),
      },
    );
  }

  await fetchJson(
    `${env.keycloakBaseUrl}/admin/realms/${env.keycloakRealm}/users/${userId}/role-mappings/realm`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(targetRoles),
    },
  );
}

export async function ensureUserSession(input: {
  email: string;
  password: string;
  roles: string[];
  firstName: string;
  lastName: string;
}) {
  const env = getEnv();

  await waitForKeycloakReady(env.keycloakBaseUrl);

  const adminToken = await getAdminToken(env);
  await ensureRealm(env, adminToken);
  env.keycloakClientSecret = await ensureClient(
    env,
    adminToken,
  );

  for (const role of ["admin", "instructor", "learner"]) {
    await ensureRealmRole(env, adminToken, role);
  }

  const userId = await ensureUser(env, adminToken, input);
  await assignRealmRoles(
    env,
    adminToken,
    userId,
    input.roles,
  );

  const params = new URLSearchParams({
    grant_type: "password",
    client_id: env.keycloakClientId,
    client_secret: env.keycloakClientSecret,
    username: input.email,
    password: input.password,
    scope: "openid",
  });

  const tokenResponse = await fetchJson<TokenResponse>(
    `${env.keycloakBaseUrl}/realms/${env.keycloakRealm}/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    },
  );

  return {
    appUrl: env.appUrl,
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    idToken: tokenResponse.id_token,
  };
}
