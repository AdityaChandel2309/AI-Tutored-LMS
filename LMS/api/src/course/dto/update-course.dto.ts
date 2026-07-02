import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateCourseDto {
  @ApiProperty({
    required: false,
    example: 'Advanced Distributed Systems',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({
    required: false,
    example: 'advanced-distributed-systems',
  })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiProperty({
    required: false,
    example: 'Refined course overview.',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    required: false,
    example: 'published',
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({
    required: false,
    example: 'public',
  })
  @IsString()
  @IsOptional()
  visibility?: string;

  @ApiProperty({
    required: false,
    example: 'category-id',
  })
  @IsString()
  @IsOptional()
  categoryId?: string | null;
}
