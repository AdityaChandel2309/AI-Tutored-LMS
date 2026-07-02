import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'user@gail.co.in',
    description: 'Keycloak username or email',
  })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({
    example: 'your-password',
  })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
