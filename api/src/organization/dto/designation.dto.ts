import { ApiProperty } from '@nestjs/swagger';

export class CreateDesignationDto {
  @ApiProperty({ example: 'Senior Engineer' })
  name!: string;

  @ApiProperty({ example: 5, description: 'Seniority level (higher = more senior)' })
  level!: number;
}

export class UpdateDesignationDto {
  @ApiProperty({ required: false })
  name?: string;

  @ApiProperty({ required: false })
  level?: number;
}
