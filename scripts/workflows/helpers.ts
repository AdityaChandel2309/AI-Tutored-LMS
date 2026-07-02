/**
 * Shared helpers for the LMS validation workflow suite.
 * Provides authentication (Keycloak password grant) and API client factory.
 */

import axios, { AxiosInstance } from 'axios';
import { SeedUser } from './types.js';

// ─── Environment Configuration ───────────────────────────────────────────────

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL || 'http://localhost:8080';
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'LMS';
const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'lms-web';
const KEYCLOAK_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET || '';

// ─── Authentication Helper ───────────────────────────────────────────────────

/**
 * Obtain an access token from Keycloak using the password grant flow.
 * @param user - A SeedUser with email and password credentials
 * @returns The access token string
 */
export async function getToken(user: SeedUser): Promise<string> {
  const tokenUrl = `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;

  const params = new URLSearchParams({
    grant_type: 'password',
    client_id: KEYCLOAK_CLIENT_ID,
    username: user.email,
    password: user.password,
  });

  if (KEYCLOAK_CLIENT_SECRET) {
    params.set('client_secret', KEYCLOAK_CLIENT_SECRET);
  }

  const response = await axios.post(tokenUrl, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  return response.data.access_token;
}

/**
 * Obtain an access token using raw credentials (email + password).
 * Useful when you don't have a full SeedUser object.
 */
export async function getTokenByCredentials(
  email: string,
  password: string,
): Promise<string> {
  const tokenUrl = `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;

  const params = new URLSearchParams({
    grant_type: 'password',
    client_id: KEYCLOAK_CLIENT_ID,
    username: email,
    password: password,
  });

  if (KEYCLOAK_CLIENT_SECRET) {
    params.set('client_secret', KEYCLOAK_CLIENT_SECRET);
  }

  const response = await axios.post(tokenUrl, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  return response.data.access_token;
}

// ─── API Client Factory ──────────────────────────────────────────────────────

/**
 * Create an axios instance pre-configured with Bearer token and tenant header.
 * @param token - A valid access token from Keycloak
 * @param tenantSubdomain - The tenant subdomain header value (default: "default")
 * @returns Configured axios instance
 */
export function apiClient(token: string, tenantSubdomain = 'default'): AxiosInstance {
  return axios.create({
    baseURL: API_BASE_URL,
    headers: {
      Authorization: `Bearer ${token}`,
      'x-tenant-subdomain': tenantSubdomain,
    },
    timeout: 30000,
    validateStatus: () => true, // Don't throw on non-2xx — let workflows inspect status
  });
}

// ─── Multi-Role Token Acquisition ────────────────────────────────────────────

export type RoleName = 'admin' | 'instructor' | 'learner' | 'employee-only';

export interface RoleTokens {
  admin: string;
  instructor: string;
  learner: string;
  'employee-only': string;
}

/**
 * Acquire tokens for multiple roles at once.
 * Accepts a map of role names to SeedUser objects and returns a map of role names to tokens.
 * @param users - Record mapping role names to SeedUser objects
 * @returns Record mapping role names to access tokens
 */
export async function getMultiRoleTokens(
  users: Partial<Record<RoleName, SeedUser>>,
): Promise<Partial<RoleTokens>> {
  const entries = Object.entries(users) as [RoleName, SeedUser][];
  const results = await Promise.all(
    entries.map(async ([role, user]) => {
      const token = await getToken(user);
      return [role, token] as [RoleName, string];
    }),
  );
  return Object.fromEntries(results) as Partial<RoleTokens>;
}

// ─── Utility Helpers ─────────────────────────────────────────────────────────

/**
 * Sleep for a given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Measure the duration of an async operation in milliseconds.
 * Returns [result, durationMs].
 */
export async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const start = Date.now();
  const result = await fn();
  return [result, Date.now() - start];
}
