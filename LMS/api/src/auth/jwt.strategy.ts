import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { PrismaService } from '../prisma/prisma.service';
import {
  getKeycloakBaseUrl,
  getKeycloakInternalUrl,
  getKeycloakRealm,
} from '../config/runtime';
import { deriveEffectiveRoles } from './roles';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private prisma: PrismaService) {
    const keycloakBaseUrl = getKeycloakBaseUrl();
    const keycloakInternalUrl = getKeycloakInternalUrl();
    const keycloakRealm = getKeycloakRealm();

    // Keycloak derives the token `iss` claim from the host used to request
    // the token. Browser-facing tokens carry the public URL, while tokens
    // obtained server-to-server (e.g. the direct-grant login proxy) carry the
    // internal Docker URL. Accept both representations of the same realm —
    // signature trust is still pinned to Keycloak's JWKS keys.
    const acceptedIssuers = Array.from(
      new Set([
        `${keycloakBaseUrl}/realms/${keycloakRealm}`,
        `${keycloakInternalUrl}/realms/${keycloakRealm}`,
      ]),
    );

    super({
      // 1) Extract from Authorization: Bearer <token>
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // 2) Validate signature via Keycloak JWKS
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${keycloakInternalUrl}/realms/${keycloakRealm}/protocol/openid-connect/certs`,
      }),

      // 3) Validate claims
      issuer: acceptedIssuers,
      algorithms: ['RS256'],
    });
  }

  async validate(payload: {
    sub: string;
    email?: string;
    realm_access?: { roles?: string[] };
  }) {
    const roles = Array.isArray(payload.realm_access?.roles)
      ? payload.realm_access?.roles
      : [];
    // Expand Keycloak's assigned roles into the platform's effective role set:
    // everyone is an employee, admins/instructors are also learners, and
    // admin/instructor may overlap. See `deriveEffectiveRoles` for the rules.
    const effectiveRoles = deriveEffectiveRoles(roles);
    const user = await this.prisma.user.findUnique({
      where: { keycloakId: payload.sub },
      select: { tenantId: true },
    });

    return {
      userId: payload.sub,
      email: payload.email,
      roles: effectiveRoles,
      tenantId: user?.tenantId ?? null,
    };
  }
}
