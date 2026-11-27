import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@TenantId() tenantId: string, @Query('take') take?: string) {
    return this.notifications.list(tenantId, take ? Number(take) : 30);
  }

  @Get('unread-count')
  unreadCount(@TenantId() tenantId: string) {
    return this.notifications.unreadCount(tenantId);
  }

  @Post(':id/read')
  markRead(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.notifications.markRead(tenantId, id);
  }

  @Post('read-all')
  markAllRead(@TenantId() tenantId: string) {
    return this.notifications.markAllRead(tenantId);
  }
}
