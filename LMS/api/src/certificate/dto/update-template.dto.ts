import { ApiProperty } from '@nestjs/swagger';

export class UpdateTemplateDto {
  @ApiProperty({ required: false, example: 'Updated Certificate Title' })
  title?: string;

  @ApiProperty({ required: false, example: 'Updated description' })
  description?: string;

  @ApiProperty({ required: false, example: true })
  isActive?: boolean;
}
