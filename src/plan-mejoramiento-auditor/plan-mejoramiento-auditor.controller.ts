import { Controller, Get, HttpStatus, Res, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { PlanMejoramientoAuditorService } from './plan-mejoramiento-auditor.service';

@ApiTags('Plan Mejoramiento Auditor')
@Controller('plan-mejoramiento-auditor')
export class PlanMejoramientoAuditorController {
  constructor(private readonly planMejoramientoAuditorService: PlanMejoramientoAuditorService) {}

  @Get()
  @ApiOperation({ summary: 'Obtiene todos los auditores del plan de mejoramiento con nombres resueltos.' })
  @ApiQuery({ name: 'filter', required: false, description: 'Filtro opcional.' })
  @ApiResponse({ status: 200, description: 'Lista obtenida con éxito.' })
  @ApiResponse({ status: 404, description: 'No se encontraron registros.' })
  async getAll(@Res() res: any, @Query() queryParams: any) {
    try {
      const data = await this.planMejoramientoAuditorService.getAll(queryParams);
      res.status(HttpStatus.OK).json(data);
    } catch (error) {
      res.status(HttpStatus.NOT_FOUND).json({
        Success: false,
        Status: HttpStatus.NOT_FOUND,
        Message: 'Error en servicio GetAll.',
        Data: error.message,
      });
    }
  }
}
