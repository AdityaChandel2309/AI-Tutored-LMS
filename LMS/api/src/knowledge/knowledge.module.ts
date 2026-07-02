import { Module } from '@nestjs/common';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { EventsModule } from '../events/events.module';
import { DocumentEmbeddingModule } from '../document-embedding/document-embedding.module';

@Module({
  imports: [PrismaModule, StorageModule, EventsModule, DocumentEmbeddingModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
