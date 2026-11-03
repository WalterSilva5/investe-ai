import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { BankingService } from './banking.service';
import { ImportStatementDto } from './dto/import-statement.dto';

@ApiTags('banking')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('banking')
export class BankingController {
  constructor(private readonly banking: BankingService) {}

  @Get('statements')
  list(@TenantId() tenantId: string) {
    return this.banking.list(tenantId);
  }

  @Get('summary')
  summary(@TenantId() tenantId: string, @Query('months') months?: string) {
    return this.banking.summary(tenantId, months ? Number(months) : 6);
  }

  @Get('categories')
  categories() {
    return this.banking.listCategories();
  }

  @Post('recategorize')
  recategorize(@TenantId() tenantId: string) {
    return this.banking.recategorize(tenantId);
  }

  @Post('reconcile')
  reconcile(@TenantId() tenantId: string) {
    return this.banking.reconcile(tenantId);
  }

  @Get('reconciliation')
  reconciliation(@TenantId() tenantId: string) {
    return this.banking.reconciliation(tenantId);
  }

  @Post('reconciliation/:id/unlink')
  unreconcile(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.banking.unreconcile(tenantId, id);
  }

  @Post('statements')
  import(@TenantId() tenantId: string, @Body() dto: ImportStatementDto) {
    return this.banking.import(tenantId, dto);
  }

  @Post('statements/upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @TenantId() tenantId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { name?: string; institution?: string; format?: string },
  ) {
    if (!file) throw new BadRequestException('Arquivo não enviado.');
    const format = (body.format || this.detectFormat(file.originalname, file.mimetype)).toUpperCase();
    return this.banking.importFile(tenantId, {
      name: body.name?.trim() || file.originalname,
      institution: body.institution?.trim() || undefined,
      format,
      buffer: file.buffer,
    });
  }

  @Get('statements/:id')
  get(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.banking.get(tenantId, id);
  }

  @Delete('statements/:id')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.banking.remove(tenantId, id);
  }

  @Patch('transactions/:id')
  updateCategory(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { category?: string },
  ) {
    if (!body?.category) throw new BadRequestException('Informe a categoria.');
    return this.banking.updateCategory(tenantId, id, body.category);
  }

  private detectFormat(filename: string, mimetype: string): string {
    const ext = (filename.split('.').pop() || '').toLowerCase();
    if (ext === 'ofx') return 'OFX';
    if (ext === 'csv') return 'CSV';
    if (ext === 'pdf') return 'PDF';
    if (mimetype?.includes('pdf')) return 'PDF';
    if (mimetype?.includes('csv')) return 'CSV';
    return 'OFX';
  }
}
