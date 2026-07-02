import { Module } from '@nestjs/common';
import { KnowledgeAssistantController } from './knowledge-assistant.controller';
import { KnowledgeAssistantService } from './knowledge-assistant.service';
import { PlatformContextService } from './platform-context.service';
import { PrismaModule } from '../prisma/prisma.module';
import { DocumentEmbeddingModule } from '../document-embedding/document-embedding.module';

@Module({
  imports: [PrismaModule, DocumentEmbeddingModule],
  controllers: [KnowledgeAssistantController],
  providers: [KnowledgeAssistantService, PlatformContextService],
})
export class KnowledgeAssistantModule {}
