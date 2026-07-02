import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({
    example: 'Engineering',
  })
  name!: string;

  @ApiProperty({
    example: 'engineering',
  })
  slug!: string;
}
