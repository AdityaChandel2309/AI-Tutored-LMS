import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CourseController } from './course.controller';
import { CourseService } from './course.service';
import { CourseWorkflowService } from './course-workflow.service';

@Module({
  imports: [PrismaModule],
  controllers: [CourseController],
  providers: [CourseService, CourseWorkflowService],
  exports: [CourseService, CourseWorkflowService],
})
export class CourseModule {}
