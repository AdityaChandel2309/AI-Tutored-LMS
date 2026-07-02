import { Body, Controller, Post } from '@nestjs/common';
import { SkipTenantCheck } from './skip-tenant-check.decorator';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { ExchangeCodeDto } from './dto/exchange-code.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@ApiTags('auth')
@Controller('auth')
@SkipTenantCheck()
@Throttle({ short: { ttl: 60000, limit: 5 } })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({
    summary: 'Authenticate with username and password (direct grant)',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 201,
    description: 'Token payload returned from Keycloak.',
  })
  login(@Body() body: LoginDto) {
    return this.authService.loginWithPassword(body.username, body.password);
  }

  @Post('exchange')
  @ApiOperation({
    summary: 'Exchange a Keycloak authorization code for tokens',
  })
  @ApiBody({ type: ExchangeCodeDto })
  @ApiResponse({
    status: 201,
    description: 'Token payload returned from Keycloak.',
  })
  exchangeCode(@Body() body: ExchangeCodeDto) {
    return this.authService.exchangeCode(body.code, body.redirect_uri);
  }

  @Post('refresh')
  @ApiOperation({
    summary: 'Refresh access and ID tokens using a refresh token',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 201,
    description: 'Refreshed token payload returned from Keycloak.',
  })
  refreshTokens(@Body() body: RefreshTokenDto) {
    return this.authService.refreshTokens(body.refreshToken);
  }

  @Post('logout')
  @ApiOperation({
    summary: 'Revoke the Keycloak session via back-channel logout',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 201,
    description: 'Session revoked (best-effort).',
  })
  async logout(@Body() body: RefreshTokenDto) {
    await this.authService.logout(body.refreshToken);
    return { ok: true };
  }
}
