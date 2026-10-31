import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { AiService } from './ai.service';
import { AiToolsService } from './ai-tools.service';
import { AiUsageService } from './ai-usage.service';
import { ChatDto } from './dto/chat.dto';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('ai')
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly tools: AiToolsService,
    private readonly usage: AiUsageService,
  ) {}

  @Post('chat')
  chat(
    @TenantId() tenantId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: ChatDto,
  ) {
    return this.ai.chat(tenantId, user.userId, dto);
  }

  @Post('chat/stream')
  async chatStream(
    @TenantId() tenantId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: ChatDto,
    @Res() response: Response,
  ) {
    response.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    try {
      for await (const event of this.ai.streamChat(tenantId, user.userId, dto)) {
        response.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (error) {
      response.write(
        `data: ${JSON.stringify({ type: 'error', message: (error as Error).message })}\n\n`,
      );
    }
    response.end();
  }

  @Get('usage')
  aiUsage(
    @TenantId() tenantId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.usage.summary(user.userId, tenantId);
  }

  @Post('tools/:name')
  tool(
    @TenantId() tenantId: string,
    @Param('name') name: string,
    @Body() args: Record<string, unknown>,
  ) {
    return this.tools.execute(name, args ?? {}, tenantId);
  }

  @Get('conversations')
  list(
    @TenantId() tenantId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.ai.listConversations(tenantId, user.userId);
  }

  @Get('conversations/:id')
  get(
    @TenantId() tenantId: string,
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.ai.getConversation(tenantId, user.userId, id);
  }
}
