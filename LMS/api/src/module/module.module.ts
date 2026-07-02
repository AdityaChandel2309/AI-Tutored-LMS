import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ModuleController } from './module.controller';
import { ModuleService } from './module.service';

@Module({
  imports: [PrismaModule],
  controllers: [ModuleController],
  providers: [ModuleService],
  exports: [ModuleService],
})
export class CourseModuleModule {}
