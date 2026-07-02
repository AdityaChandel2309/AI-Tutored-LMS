import { ApiProperty } from '@nestjs/swagger';

export class UpdateCategoryDto {
  @ApiProperty({
    required: false,
    example: 'Platform Engineering',
  })
  name?: string;

  @ApiProperty({
    required: false,
    example: 'platform-engineering',
  })
  slug?: string;
}
