import { Controller, Get, Param, HttpStatus, Res, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { PlanAuditoriaService } from './plan-auditoria.service';

@ApiTags('Plan Auditoría')
@Controller('plan-auditoria')
export class PlanAuditoriaController {
  constructor(private readonly planAuditoriaService: PlanAuditoriaService) {}

  @Get()
  @ApiOperation({ summary: 'Obtiene todos los planes de auditoría.' })
  @ApiQuery({
    name: 'filter',
    required: false,
    description: 'Filtro opcional.',
  })
  @ApiResponse({ status: 200, description: 'Lista obtenida con éxito.' })
  @ApiResponse({ status: 404, description: 'No se encontraron planes.' })
  async getAll(@Res() res, @Query() queryParams) {
    try {
      const data = await this.planAuditoriaService.getAll(queryParams);
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

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene un plan por ID.' })
  @ApiParam({ name: 'id', required: true, description: 'ID del plan.' })
  @ApiResponse({ status: 200, description: 'Plan obtenido con éxito.' })
  @ApiResponse({ status: 404, description: 'No se encontró el plan.' })
  async getById(@Param('id') id: string) {
    return await this.planAuditoriaService.getOne(id);
  }
}
