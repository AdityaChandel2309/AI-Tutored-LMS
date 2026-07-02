import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { EventsModule } from '../events/events.module';
import { VideoService } from './video.service';
import { VideoProcessingService } from './video-processing.service';
import { VideoController } from './video.controller';

@Module({
  imports: [PrismaModule, StorageModule, EventsModule],
  controllers: [VideoController],
  providers: [VideoService, VideoProcessingService],
  exports: [VideoService],
})
export class VideoModule {}
