import { BadRequestException, Controller, Get, HttpStatus, Res, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { GestionAccionesService } from './gestion-acciones.service';

@ApiTags('Gestión de Acciones')
@Controller('gestion-accion')
export class GestionAccionesController {
  constructor(private readonly gestionAccionesService: GestionAccionesService) {}

  @Get()
  @ApiOperation({
    summary:
      'Lista las acciones de mejora de una vigencia con auditoría, hallazgo, auditores y dependencias resueltos.',
  })
  @ApiQuery({ name: 'vigencia_id', required: true, description: 'Vigencia a consultar.' })
  @ApiQuery({
    name: 'estado_plan_id',
    required: false,
    description:
      'Estados del plan de mejoramiento a incluir, separados por "|" (p. ej. aprobado|finalizado). Sin el filtro se listan todos.',
  })
  @ApiQuery({ name: 'no_auditoria', required: false })
  @ApiQuery({ name: 'nombre_auditoria', required: false })
  @ApiQuery({ name: 'no_hallazgo', required: false })
  @ApiQuery({ name: 'no_accion', required: false })
  @ApiQuery({ name: 'auditor', required: false })
  @ApiQuery({ name: 'dependencia', required: false })
  @ApiQuery({ name: 'desde', required: false, description: 'Fecha inicio mínima (ISO).' })
  @ApiQuery({ name: 'hasta', required: false, description: 'Fecha inicio máxima (ISO).' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiResponse({ status: 200, description: 'Lista obtenida con éxito.' })
  @ApiResponse({ status: 400, description: 'Parámetros inválidos (estado_plan_id).' })
  @ApiResponse({ status: 404, description: 'Error en la consulta.' })
  async getAll(@Res() res: any, @Query() queryParams: any) {
    try {
      const data = await this.gestionAccionesService.getAll(queryParams);
      res.status(HttpStatus.OK).json(data);
    } catch (error) {
      if (error instanceof BadRequestException) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          Success: false,
          Status: HttpStatus.BAD_REQUEST,
          Message: error.message,
          Data: null,
        });
      }
      res.status(HttpStatus.NOT_FOUND).json({
        Success: false,
        Status: HttpStatus.NOT_FOUND,
        Message: 'Error en servicio GetAll.',
        Data: error.message,
      });
    }
  }
}
