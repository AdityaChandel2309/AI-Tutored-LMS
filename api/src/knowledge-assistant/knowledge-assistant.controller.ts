import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { TenantAwareRequest } from '../tenant/tenant.middleware';
import { KnowledgeAssistantService } from './knowledge-assistant.service';
import { RequireFeature } from '../common/guards/feature-flag.guard';

class AskQuestionDto {
  @ApiProperty({ example: 'What is the safety procedure for pipeline maintenance?' })
  @IsString()
  @IsNotEmpty()
  question!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  categoryId?: string;
}

@ApiTags('knowledge-assistant')
@ApiBearerAuth()
@Controller('knowledge-assistant')
@Throttle({ short: { ttl: 60000, limit: 10 } })
@RequireFeature('knowledgeAssistant')
export class KnowledgeAssistantController {
  constructor(private readonly service: KnowledgeAssistantService) {}

  @UseGuards(JwtAuthGuard)
  @Post('ask')
  @ApiOperation({ summary: 'Ask the enterprise knowledge assistant' })
  @ApiBody({ type: AskQuestionDto })
  ask(@Request() req: TenantAwareRequest, @Body() dto: AskQuestionDto) {
    return this.service.ask(
      req.tenant?.id ?? null,
      req.user?.userId ?? '',
      dto.question,
      dto.categoryId,
      req.user?.roles ?? [],
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('history')
  @ApiOperation({ summary: 'Get knowledge assistant chat history' })
  getHistory(@Request() req: TenantAwareRequest) {
    return this.service.getHistory(req.tenant?.id ?? null, req.user?.userId ?? '');
  }
}
