import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateModuleDto {
  @ApiProperty({
    example: 'Getting Started',
  })
  @IsString()
  title!: string;

  @ApiProperty({
    required: false,
    example: 1,
    description:
      'Display order within the course. Auto-assigned to the end if omitted.',
  })
  @IsOptional()
  @IsNumber()
  order?: number;
}
