import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber } from 'class-validator';

export class UpdateModuleDto {
  @ApiProperty({
    required: false,
    example: 'Advanced Topics',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({
    required: false,
    example: 2,
  })
  @IsOptional()
  @IsNumber()
  order?: number;
}
