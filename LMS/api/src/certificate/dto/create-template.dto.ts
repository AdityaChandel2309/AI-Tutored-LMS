import { ApiProperty } from '@nestjs/swagger';

export class CreateTemplateDto {
  @ApiProperty({ example: 'Certificate of Completion' })
  title!: string;

  @ApiProperty({
    required: false,
    example: 'Awarded for completing the full course',
  })
  description?: string;
}
