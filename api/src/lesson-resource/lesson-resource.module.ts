import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { LessonResourceController } from './lesson-resource.controller';
import { LessonResourceService } from './lesson-resource.service';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [LessonResourceController],
  providers: [LessonResourceService],
  exports: [LessonResourceService],
})
export class LessonResourceModule {}