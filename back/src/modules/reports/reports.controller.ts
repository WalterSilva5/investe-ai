import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('portfolio/:id/csv')
  async portfolioCsv(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Res() response: Response,
  ) {
    const csv = await this.reports.portfolioCsv(tenantId, id);
    response
      .status(200)
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="portfolio-${id}.csv"`)
      .send(csv);
  }

  @Get('portfolio/:id/pdf')
  async portfolioPdf(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Res() response: Response,
  ) {
    const pdf = await this.reports.portfolioPdf(tenantId, id);
    response
      .status(200)
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="portfolio-${id}.pdf"`)
      .send(pdf);
  }
}
