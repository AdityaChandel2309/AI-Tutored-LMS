import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    example: 'admin@example.com',
  })
  email!: string;

  @ApiPropertyOptional({
    example: 'Admin',
  })
  firstName?: string;

  @ApiPropertyOptional({
    example: 'User',
  })
  lastName?: string;

  @ApiProperty({
    example: 'Temp123!',
  })
  temporaryPassword!: string;

  @ApiProperty({
    example: ['admin'],
    type: [String],
  })
  roles!: string[];
}
