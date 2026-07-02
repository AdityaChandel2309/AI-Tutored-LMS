import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { TenantAwareRequest } from '../tenant/tenant.middleware';
import { AiTutorService } from './ai-tutor.service';
import { ChatMessageDto } from './dto/chat-message.dto';
import { RequireFeature } from '../common/guards/feature-flag.guard';

@ApiTags('ai-tutor')
@ApiBearerAuth()
@Controller('ai-tutor')
@Throttle({ short: { ttl: 60000, limit: 10 } })
@RequireFeature('aiTutor')
export class AiTutorController {
  constructor(private readonly aiTutorService: AiTutorService) {}

  @UseGuards(JwtAuthGuard)
  @Post('chat')
  @ApiOperation({ summary: 'Send message to AI tutor' })
  @ApiBody({ type: ChatMessageDto })
  chat(@Request() req: TenantAwareRequest, @Body() dto: ChatMessageDto) {
    return this.aiTutorService.chat(req.tenant?.id ?? null, req.user?.userId ?? '', dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('history')
  @ApiOperation({ summary: 'Get AI tutor chat history for a course' })
  getHistory(@Request() req: TenantAwareRequest, @Query('courseId') courseId: string) {
    return this.aiTutorService.getHistory(req.tenant?.id ?? null, req.user?.userId ?? '', courseId);
  }
}
