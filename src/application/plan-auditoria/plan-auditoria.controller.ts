import { Controller, Get, Param, HttpStatus, Query } from '@nestjs/common';
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
  @ApiResponse({ status: HttpStatus.OK, description: 'Lista obtenida con éxito.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No se encontraron planes.' })
  async getAll(@Query() queryParams: any) {
    return this.planAuditoriaService.getAll(queryParams);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene un plan por ID.' })
  @ApiParam({ name: 'id', required: true, description: 'ID del plan.' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Plan obtenido con éxito.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No se encontró el plan.' })
  async getById(@Param('id') id: string) {
    return this.planAuditoriaService.getOne(id);
  }
}
