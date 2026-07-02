import { ApiProperty } from '@nestjs/swagger';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Engineering' })
  name!: string;

  @ApiProperty({ example: 'ENG' })
  code!: string;

  @ApiProperty({ required: false })
  parentId?: string;

  @ApiProperty({ required: false })
  managerId?: string;
}
