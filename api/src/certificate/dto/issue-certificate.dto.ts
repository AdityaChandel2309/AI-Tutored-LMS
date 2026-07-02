import { ApiProperty } from '@nestjs/swagger';

export class IssueCertificateDto {
  @ApiProperty({ example: 'enrollment-uuid-here' })
  enrollmentId!: string;
}
