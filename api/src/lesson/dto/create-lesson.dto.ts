import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateLessonDto {
  @ApiProperty({
    example: 'Introduction to Microservices',
  })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({
    example: 'video',
    description: 'Lesson type, e.g. video, text, quiz, scorm',
  })
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiProperty({
    required: false,
    example: { body: 'Lesson body content or reference' },
    description: 'Arbitrary JSON content for the lesson',
  })
  @IsObject()
  @IsOptional()
  content?: Record<string, any>;

  @ApiProperty({
    required: false,
    example: 300,
    description: 'Estimated duration in seconds',
  })
  @IsNumber()
  @IsOptional()
  duration?: number;

  @ApiProperty({
    required: false,
    example: 1,
    description: 'Explicit lesson order within the module (auto-assigned when omitted)',
  })
  @IsNumber()
  @IsOptional()
  order?: number;
}
