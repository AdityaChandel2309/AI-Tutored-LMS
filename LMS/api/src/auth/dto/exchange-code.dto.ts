import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ExchangeCodeDto {
  @ApiProperty({
    example: 'auth-code-from-keycloak',
  })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiPropertyOptional({
    example: 'http://localhost:3001/callback',
  })
  @IsString()
  @IsOptional()
  redirect_uri?: string;
}
