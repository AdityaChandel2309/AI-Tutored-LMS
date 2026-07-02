import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserRolesDto {
  @ApiProperty({
    example: ['instructor'],
    type: [String],
  })
  roles!: string[];
}
