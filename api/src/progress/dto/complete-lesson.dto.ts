import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * xAPI-style completion statement sent by the frontend auto-trackers
 * (video 90%, text scroll-to-end, quiz pass).
 *
 * Shape mirrors a minimal xAPI statement:
 *   { userId, lessonId, status: "completed", timestamp }
 *
 * Note: `userId` is accepted for xAPI fidelity but is NOT trusted — the
 * authenticated session/token always determines whose progress is written.
 */
export class CompleteLessonDto {
  @ApiProperty({
    example: 'course-uuid',
    description: 'The course the lesson belongs to',
  })
  @IsString()
  courseId!: string;

  @ApiProperty({
    example: 'lesson-uuid',
    description: 'The lesson being completed',
  })
  @IsString()
  lessonId!: string;

  @ApiProperty({
    required: false,
    example: 'completed',
    description:
      'xAPI verb/status. Only "completed" is currently acted upon; defaults to "completed".',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({
    required: false,
    example: '2026-06-04T10:30:00.000Z',
    description: 'Client-side ISO timestamp (advisory only)',
  })
  @IsOptional()
  @IsString()
  timestamp?: string;

  @ApiProperty({
    required: false,
    example: '123',
    description:
      'xAPI actor id. Accepted for fidelity but ignored — the session decides.',
  })
  @IsOptional()
  @IsString()
  userId?: string;
}
