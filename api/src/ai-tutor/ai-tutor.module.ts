import { Module } from '@nestjs/common';
import { AiTutorController } from './ai-tutor.controller';
import { AiTutorService } from './ai-tutor.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AiTutorController],
  providers: [AiTutorService],
})
export class AiTutorModule {}
