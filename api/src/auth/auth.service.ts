import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import axios from 'axios';
import {
  getKeycloakBaseUrl,
  getKeycloakClientId,
  getKeycloakInternalUrl,
  getKeycloakRealm,
  getKeycloakRedirectUri,
} from '../config/runtime';

type KeycloakCreateUserInput = {
  email: string;
  firstName?: string;
  lastName?: string;
  temporaryPassword: string;
  roles: string[];
};

type KeycloakTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in?: number;
  id_token?: string;
  token_type?: string;
  scope?: string;
};

type KeycloakRealmRole = {
  id: string;
  name: string;
  description?: string;
  composite?: boolean;
  clientRole?: boolean;
  containerId?: string;
};

@Injectable()
export class AuthService {
  private readonly keycloakBaseUrl = getKeycloakBaseUrl();
  private readonly keycloakInternalUrl = getKeycloakInternalUrl();
  private readonly keycloakRealm = getKeycloakRealm();
  private readonly clientId = getKeycloakClientId();
  private readonly clientSecret = process.env.KEYCLOAK_CLIENT_SECRET;
  private readonly redirectUri = getKeycloakRedirectUri();
  private readonly adminRealm = process.env.KEYCLOAK_ADMIN_REALM ?? 'master';
  private readonly adminClientId =
    process.env.KEYCLOAK_ADMIN_CLIENT_ID ?? 'admin-cli';
  private readonly allowedRoles = ['admin', 'instructor', 'learner'];
  private cachedAdminToken: { token: string; expiresAt: number } | null = null;

  async exchangeCode(
    code: string,
    redirectUriOverride?: string,
  ): Promise<KeycloakTokenResponse> {
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append(
      'redirect_uri',
      redirectUriOverride ?? this.redirectUri,
    );

    return this.requestRealmTokens(params);
  }

  async loginWithPassword(
    username: string,
    password: string,
  ): Promise<KeycloakTokenResponse> {
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('scope', 'openid');
    params.append('username', username);
    params.append('password', password);

    return this.requestRealmTokens(params, {
      treatInvalidGrantAsUnauthorized: true,
    });
  }

  async refreshTokens(refreshToken: string): Promise<KeycloakTokenResponse> {
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);

    return this.requestRealmTokens(params);
  }

  /**
   * Back-channel logout: revoke the user's Keycloak session using their
   * refresh token. This ends the SSO session server-side without redirecting
   * the browser to Keycloak's hosted logout page. Best-effort — a failure to
   * reach Keycloak must not block the local session from being cleared.
   */
  async logout(refreshToken: string): Promise<void> {
    if (!this.clientSecret) {
      return;
    }

    const params = new URLSearchParams();
    params.append('client_id', this.clientId);
    params.append('client_secret', this.clientSecret);
    params.append('refresh_token', refreshToken);

    try {
      await axios.post(
        `${this.keycloakInternalUrl}/realms/${this.keycloakRealm}/protocol/openid-connect/logout`,
        params,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          validateStatus: () => true,
        },
      );
    } catch {
      // Best-effort: swallow network/Keycloak errors so the caller can still
      // clear the local session cookies and complete the logout.
    }
  }

  async createKeycloakUser({
    email,
    firstName,
    lastName,
    temporaryPassword,
    roles,
  }: KeycloakCreateUserInput) {
    const adminToken = await this.getAdminAccessToken();
    const normalizedRoles = this.filterSupportedRoles(roles);

    try {
      const response = await axios.post(
        `${this.adminApiBaseUrl}/users`,
        {
          email,
          username: email,
          firstName,
          lastName,
          enabled: true,
          emailVerified: true,
          credentials: [
            {
              temporary: true,
              type: 'password',
              value: temporaryPassword,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
          validateStatus: () => true,
        },
      );

      if (response.status === 409) {
        throw new ConflictException(
          'A Keycloak user with this email already exists',
        );
      }

      if (response.status < 200 || response.status >= 300) {
        throw new InternalServerErrorException(
          'Failed to create user in Keycloak',
        );
      }

      const locationHeader =
        typeof response.headers?.location === 'string'
          ? response.headers.location
          : undefined;
      const keycloakUserId =
        this.extractUserIdFromLocationHeader(locationHeader);

      if (!keycloakUserId) {
        throw new InternalServerErrorException(
          'Keycloak user was created but no user id was returned',
        );
      }

      await this.replaceRealmRoles(keycloakUserId, normalizedRoles, adminToken);

      return {
        keycloakUserId,
        roles: normalizedRoles,
      };
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to create user in Keycloak',
      );
    }
  }

  async updateUserRoles(keycloakUserId: string, roles: string[]) {
    const adminToken = await this.getAdminAccessToken();
    const normalizedRoles = this.filterSupportedRoles(roles);

    await this.replaceRealmRoles(keycloakUserId, normalizedRoles, adminToken);

    return normalizedRoles;
  }

  async deactivateUser(keycloakUserId: string) {
    const adminToken = await this.getAdminAccessToken();

    try {
      const response = await axios.put(
        `${this.adminApiBaseUrl}/users/${keycloakUserId}`,
        {
          enabled: false,
        },
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
          validateStatus: () => true,
        },
      );

      if (response.status < 200 || response.status >= 300) {
        throw new InternalServerErrorException(
          'Failed to deactivate user in Keycloak',
        );
      }
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to deactivate user in Keycloak',
      );
    }
  }

  private async replaceRealmRoles(
    keycloakUserId: string,
    roles: string[],
    adminToken: string,
  ) {
    const availableRoles = await this.getRealmRoles(adminToken);
    const selectedRoles = availableRoles.filter(({ name }) =>
      roles.includes(name),
    );

    try {
      const existingRoleResponse = await axios.get<KeycloakRealmRole[]>(
        `${this.adminApiBaseUrl}/users/${keycloakUserId}/role-mappings/realm`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        },
      );

      const existingRoles = existingRoleResponse.data ?? [];

      if (existingRoles.length > 0) {
        await axios.request({
          method: 'delete',
          url: `${this.adminApiBaseUrl}/users/${keycloakUserId}/role-mappings/realm`,
          data: existingRoles,
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        });
      }

      if (selectedRoles.length > 0) {
        await axios.post(
          `${this.adminApiBaseUrl}/users/${keycloakUserId}/role-mappings/realm`,
          selectedRoles,
          {
            headers: {
              Authorization: `Bearer ${adminToken}`,
            },
          },
        );
      }
    } catch {
      throw new InternalServerErrorException(
        'Failed to sync user roles in Keycloak',
      );
    }
  }

  private async getRealmRoles(
    adminToken: string,
  ): Promise<Array<{ id: string; name: string }>> {
    try {
      const response = await axios.get<KeycloakRealmRole[]>(
        `${this.adminApiBaseUrl}/roles`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        },
      );

      return response.data ?? [];
    } catch {
      throw new InternalServerErrorException(
        'Failed to load Keycloak realm roles',
      );
    }
  }

  private async getAdminAccessToken() {
    if (this.cachedAdminToken && Date.now() < this.cachedAdminToken.expiresAt) {
      return this.cachedAdminToken.token;
    }

    const username = process.env.KEYCLOAK_ADMIN_USER;
    const password = process.env.KEYCLOAK_ADMIN_PASSWORD;

    if (!username || !password) {
      throw new InternalServerErrorException(
        'Keycloak admin credentials are not configured',
      );
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('client_id', this.adminClientId);
    params.append('username', username);
    params.append('password', password);

    try {
      const response = await axios.post<KeycloakTokenResponse>(
        `${this.keycloakInternalUrl}/realms/${this.adminRealm}/protocol/openid-connect/token`,
        params,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      this.cachedAdminToken = {
        token: response.data.access_token,
        expiresAt: Date.now() + (response.data.expires_in - 60) * 1000,
      };

      return response.data.access_token;
    } catch {
      this.cachedAdminToken = null;
      throw new InternalServerErrorException(
        'Failed to obtain Keycloak admin token',
      );
    }
  }

  private async requestRealmTokens(
    params: URLSearchParams,
    options: { treatInvalidGrantAsUnauthorized?: boolean } = {},
  ): Promise<KeycloakTokenResponse> {
    if (!this.clientSecret) {
      throw new InternalServerErrorException(
        'Keycloak client secret is not configured',
      );
    }

    params.append('client_id', this.clientId);
    params.append('client_secret', this.clientSecret);

    try {
      const response = await axios.post<KeycloakTokenResponse>(
        `${this.keycloakInternalUrl}/realms/${this.keycloakRealm}/protocol/openid-connect/token`,
        params,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      return response.data;
    } catch (error: unknown) {
      const axiosError = error as {
        response?: { status?: number; data?: { error?: string } };
      };
      const status = axiosError.response?.status;
      const data = axiosError.response?.data;

      if (
        options.treatInvalidGrantAsUnauthorized &&
        (status === 401 ||
          (status === 400 && data?.error === 'invalid_grant'))
      ) {
        throw new UnauthorizedException('Invalid username or password');
      }

      throw new InternalServerErrorException(
        `Failed to obtain tokens from Keycloak: ${status} ${JSON.stringify(data)}`,
      );
    }
  }

  private filterSupportedRoles(roles: string[]) {
    return Array.from(
      new Set(
        roles
          .map((role) => role.trim())
          .filter((role) => this.allowedRoles.includes(role)),
      ),
    );
  }

  private extractUserIdFromLocationHeader(locationHeader?: string) {
    if (!locationHeader) {
      return null;
    }

    const locationSegments = locationHeader.split('/');

    return locationSegments[locationSegments.length - 1] || null;
  }

  private get adminApiBaseUrl() {
    return `${this.keycloakInternalUrl}/admin/realms/${this.keycloakRealm}`;
  }
}
