import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateLessonDto {
  @ApiProperty({
    required: false,
    example: 'Revised Introduction',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({
    required: false,
    example: 'text',
  })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiProperty({
    required: false,
    example: { body: 'Updated content' },
  })
  @IsObject()
  @IsOptional()
  content?: Record<string, any> | null;

  @ApiProperty({
    required: false,
    example: 600,
  })
  @IsNumber()
  @IsOptional()
  duration?: number | null;

  @ApiProperty({
    required: false,
    example: 2,
    description: 'Reorder the lesson within its module',
  })
  @IsNumber()
  @IsOptional()
  order?: number | null;
}
