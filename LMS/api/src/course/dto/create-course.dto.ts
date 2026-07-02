import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCourseDto {
  @ApiProperty({
    example: 'Foundations of Distributed Systems',
  })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({
    example: 'foundations-of-distributed-systems',
  })
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @ApiProperty({
    required: false,
    example: 'Core concepts for reliable platform design.',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    required: false,
    example: 'draft',
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({
    required: false,
    example: 'private',
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
  categoryId?: string;
}
