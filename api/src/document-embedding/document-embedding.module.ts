import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DocumentEmbeddingController } from './document-embedding.controller';
import { DocumentEmbeddingService } from './document-embedding.service';

@Module({
  imports: [PrismaModule],
  controllers: [DocumentEmbeddingController],
  providers: [DocumentEmbeddingService],
  exports: [DocumentEmbeddingService],
})
export class DocumentEmbeddingModule {}
