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
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.documents.list(tenantId);
  }

  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateDocumentDto) {
    return this.documents.create(tenantId, dto);
  }

  @Get('search')
  search(@TenantId() tenantId: string, @Query('q') q: string) {
    return this.documents.search(tenantId, q || '');
  }

  @Get(':id')
  get(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.documents.get(tenantId, id);
  }

  @Delete(':id')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.documents.remove(tenantId, id);
  }
}
