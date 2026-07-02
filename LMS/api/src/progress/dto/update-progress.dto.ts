import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

const PROGRESS_STATES = [
  'not_started',
  'in_progress',
  'completed',
  'locked',
] as const;

export class UpdateProgressDto {
  @ApiProperty({
    example: 'lesson-uuid',
    description: 'The lesson to track progress for',
  })
  @IsString()
  lessonId!: string;

  @ApiProperty({
    example: 'in_progress',
    description: 'Lesson state: not_started, in_progress, completed, locked',
  })
  @IsString()
  @IsIn(PROGRESS_STATES as unknown as string[])
  state!: string;

  @ApiProperty({
    required: false,
    example: 0.5,
    description: 'Lesson-level progress as a fraction (0 to 1)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  progress?: number;
}
