import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { MemoriesService } from './memories.service';
import { CreateMemoryDto } from './dto/create-memory.dto';

@ApiTags('memories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('memories')
export class MemoriesController {
  constructor(private readonly memories: MemoriesService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.memories.list(tenantId);
  }

  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateMemoryDto) {
    return this.memories.create(tenantId, dto);
  }

  @Get('search')
  search(@TenantId() tenantId: string, @Query('q') q: string) {
    return this.memories.search(tenantId, q || '');
  }

  @Delete(':id')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.memories.remove(tenantId, id);
  }
}
