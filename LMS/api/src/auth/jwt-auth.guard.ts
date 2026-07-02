import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser,
    info?: { message?: string },
  ): TUser {
    const message = info?.message ?? 'Unauthorized';

    if (err) {
      throw err instanceof Error ? err : new UnauthorizedException(message);
    }

    if (!user) {
      throw new UnauthorizedException(message);
    }
    return user;
  }
}
