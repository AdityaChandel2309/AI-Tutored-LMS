import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { ScormController } from './scorm.controller';
import { ScormService } from './scorm.service';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [ScormController],
  providers: [ScormService],
  exports: [ScormService],
})
export class ScormModule {}
