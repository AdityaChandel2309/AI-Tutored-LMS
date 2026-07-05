import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    example: 'admin@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({
    example: 'Admin',
  })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({
    example: 'User',
  })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({
    example: 'Temp123!',
  })
  @IsString()
  @MinLength(6)
  temporaryPassword!: string;

  @ApiProperty({
    example: ['admin'],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  roles!: string[];
}
