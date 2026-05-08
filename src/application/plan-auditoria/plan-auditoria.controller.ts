import { Controller, Get, Post, Param, Body, HttpStatus, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { PlanAuditoriaService } from './plan-auditoria.service';
import { GeneracionAuditoriaService } from 'src/shared/services/generacion-auditoria.service';

@ApiTags('Plan Auditoría')
@Controller('plan-auditoria')
export class PlanAuditoriaController {
  constructor(
    private readonly planAuditoriaService: PlanAuditoriaService,
    private readonly generacionAuditoriaService: GeneracionAuditoriaService
  ) {}

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

  @Post(':id/generar-auditorias')
  @ApiOperation({ summary: 'Genera auditorías hijas para todas las auditorías padre de un plan.' })
  @ApiParam({ name: 'id', required: true, description: 'ID del plan de auditoría.' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        usuario_id: { type: 'number' },
        usuario_rol: { type: 'string' },
        observacion: { type: 'string' },
        estado_id_padre_actual: { type: 'number' },
        estado_id_padre_nuevo: { type: 'number' },
        estado_id_hija_nuevo: { type: 'number' },
        fase_id: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Auditorías generadas exitosamente.' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Error en la solicitud.' })
  async generarAuditorias(@Param('id') id: string, @Body() body: any) {
    return this.generacionAuditoriaService.generarAuditorias(id, body);
  }
}
