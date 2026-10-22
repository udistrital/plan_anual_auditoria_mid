import { Body, Controller, Get, HttpStatus, Param, Post, Res, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBody } from '@nestjs/swagger';
import { PlanMejoramientoService } from './plan-mejoramiento.service';

@ApiTags('Plan Mejoramiento')
@Controller('plan-mejoramiento')
export class PlanMejoramientoController {
  constructor(private readonly planMejoramientoService: PlanMejoramientoService) {}

  @Get()
  @ApiOperation({ summary: 'Obtiene planes de mejoramiento con estado resuelto.' })
  @ApiQuery({ name: 'filter', required: false, description: 'Filtro opcional.' })
  @ApiResponse({ status: 200, description: 'Lista obtenida con éxito.' })
  @ApiResponse({ status: 404, description: 'No se encontraron registros.' })
  async getAll(@Res() res: any, @Query() queryParams: any) {
    try {
      const data = await this.planMejoramientoService.getAll(queryParams);
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

  @Post(':id/numerar-acciones')
  @ApiOperation({
    summary:
      'Asigna no_accion a las acciones de un plan aprobado o finalizado que aún no lo tienen.',
  })
  @ApiParam({ name: 'id', required: true, description: 'ID del plan de mejoramiento.' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Números de acción del plan.' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Plan no aprobado, sin acciones o con numeración parcial.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Plan de mejoramiento no encontrado.' })
  async numerarPlanAprobado(@Param('id') id: string) {
    return this.planMejoramientoService.numerarPlanAprobado(id);
  }

  @Post(':id/aprobar')
  @ApiOperation({
    summary: 'Aprueba el plan de mejoramiento y genera el no_accion de sus acciones.',
  })
  @ApiParam({ name: 'id', required: true, description: 'ID del plan de mejoramiento.' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        usuario_id: { type: 'number' },
        usuario_rol: { type: 'string' },
        observacion: { type: 'string' },
        fase_id: { type: 'number' },
        fecha_ejecucion_estado: { type: 'string' },
        activo: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Plan aprobado y acciones numeradas.' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'El plan no está en revisión o faltan datos para numerar.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Plan de mejoramiento no encontrado.' })
  async aprobar(@Param('id') id: string, @Body() body: any) {
    return this.planMejoramientoService.aprobar(id, body);
  }
}
