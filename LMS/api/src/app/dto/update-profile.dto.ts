import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    example: 'Ada',
  })
  firstName?: string;

  @ApiPropertyOptional({
    example: 'Lovelace',
  })
  lastName?: string;
}
