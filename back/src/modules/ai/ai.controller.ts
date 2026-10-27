import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { AiService } from './ai.service';
import { AiToolsService } from './ai-tools.service';
import { ChatDto } from './dto/chat.dto';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('ai')
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly tools: AiToolsService,
  ) {}

  @Post('chat')
  chat(
    @TenantId() tenantId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: ChatDto,
  ) {
    return this.ai.chat(tenantId, user.userId, dto);
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
