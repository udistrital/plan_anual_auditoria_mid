import {
  BadRequestException,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Res,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
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

  @Get('auditado/:personaId/:cargoId/resumen')
  @ApiOperation({
    summary:
      'Conteos de las acciones de los planes aprobados de las dependencias del auditado, por grupo de estado.',
  })
  @ApiParam({
    name: 'personaId',
    required: true,
    description: 'ID de la persona (tercero).',
  })
  @ApiParam({
    name: 'cargoId',
    required: true,
    description: 'ID del cargo (312 o 320).',
  })
  @ApiQuery({ name: 'vigencia_id', required: true })
  @ApiQuery({ name: 'tipo_evaluacion_id', required: true })
  @ApiResponse({ status: 200, description: 'Resumen obtenido con éxito.' })
  @ApiResponse({ status: 404, description: 'Error en la consulta.' })
  async getResumenAuditado(
    @Res() res: any,
    @Param('personaId', ParseIntPipe) personaId: number,
    @Param('cargoId', ParseIntPipe) cargoId: number,
    @Query() queryParams: any,
  ) {
    try {
      const data = await this.gestionAccionesService.getResumenAuditado(
        personaId,
        cargoId,
        queryParams,
      );
      res.status(HttpStatus.OK).json(data);
    } catch (error) {
      res.status(HttpStatus.NOT_FOUND).json({
        Success: false,
        Status: HttpStatus.NOT_FOUND,
        Message: 'Error en servicio GetResumenAuditado.',
        Data: error.message,
      });
    }
  }

  @Get('auditado/:personaId/:cargoId')
  @ApiOperation({
    summary:
      'Lista las acciones de los planes aprobados de las dependencias del auditado.',
  })
  @ApiParam({
    name: 'personaId',
    required: true,
    description: 'ID de la persona (tercero).',
  })
  @ApiParam({
    name: 'cargoId',
    required: true,
    description: 'ID del cargo (312 o 320).',
  })
  @ApiQuery({ name: 'vigencia_id', required: true })
  @ApiQuery({ name: 'tipo_evaluacion_id', required: true })
  @ApiQuery({
    name: 'grupo',
    required: false,
    enum: [
      'PENDIENTE_HABILITAR',
      'CARGUE_ABIERTO',
      'EN_REVISION',
      'CALIFICADAS',
      'EN_RIESGO',
    ],
  })
  @ApiQuery({ name: 'no_auditoria', required: false })
  @ApiQuery({ name: 'accion_hallazgo', required: false })
  @ApiQuery({ name: 'dependencia', required: false })
  @ApiQuery({ name: 'auditor', required: false })
  @ApiQuery({ name: 'desde', required: false, description: 'Cronograma desde (ISO).' })
  @ApiQuery({ name: 'hasta', required: false, description: 'Cronograma hasta (ISO).' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiResponse({ status: 200, description: 'Lista obtenida con éxito.' })
  @ApiResponse({ status: 404, description: 'Error en la consulta.' })
  async getAllAuditado(
    @Res() res: any,
    @Param('personaId', ParseIntPipe) personaId: number,
    @Param('cargoId', ParseIntPipe) cargoId: number,
    @Query() queryParams: any,
  ) {
    try {
      const data = await this.gestionAccionesService.getAllAuditado(
        personaId,
        cargoId,
        queryParams,
      );
      res.status(HttpStatus.OK).json(data);
    } catch (error) {
      res.status(HttpStatus.NOT_FOUND).json({
        Success: false,
        Status: HttpStatus.NOT_FOUND,
        Message: 'Error en servicio GetAllAuditado.',
        Data: error.message,
      });
    }
  }

  @Get('auditor/:personaId/resumen')
  @ApiOperation({
    summary:
      'Conteos de las acciones de los planes aprobados que ve el auditor, por grupo de estado.',
  })
  @ApiParam({
    name: 'personaId',
    required: true,
    description: 'ID de la persona (tercero) del auditor.',
  })
  @ApiQuery({ name: 'vigencia_id', required: true })
  @ApiQuery({ name: 'tipo_evaluacion_id', required: true })
  @ApiQuery({
    name: 'alcance',
    required: false,
    enum: ['asignadas', 'todas'],
    description: 'asignadas (por defecto) o todas las de la institución.',
  })
  @ApiResponse({ status: 200, description: 'Resumen obtenido con éxito.' })
  @ApiResponse({ status: 404, description: 'Error en la consulta.' })
  async getResumenAuditor(
    @Res() res: any,
    @Param('personaId', ParseIntPipe) personaId: number,
    @Query() queryParams: any,
  ) {
    try {
      const data = await this.gestionAccionesService.getResumenAuditor(
        personaId,
        queryParams,
      );
      res.status(HttpStatus.OK).json(data);
    } catch (error) {
      res.status(HttpStatus.NOT_FOUND).json({
        Success: false,
        Status: HttpStatus.NOT_FOUND,
        Message: 'Error en servicio GetResumenAuditor.',
        Data: error.message,
      });
    }
  }

  @Get('auditor/:personaId')
  @ApiOperation({
    summary:
      'Lista las acciones de los planes aprobados que ve el auditor, según su alcance.',
  })
  @ApiParam({
    name: 'personaId',
    required: true,
    description: 'ID de la persona (tercero) del auditor.',
  })
  @ApiQuery({ name: 'vigencia_id', required: true })
  @ApiQuery({ name: 'tipo_evaluacion_id', required: true })
  @ApiQuery({
    name: 'alcance',
    required: false,
    enum: ['asignadas', 'todas'],
    description: 'asignadas (por defecto) o todas las de la institución.',
  })
  @ApiQuery({
    name: 'grupo',
    required: false,
    enum: [
      'PENDIENTE_HABILITAR',
      'CARGUE_ABIERTO',
      'EN_REVISION',
      'CALIFICADAS',
      'EN_RIESGO',
    ],
  })
  @ApiQuery({ name: 'no_auditoria', required: false })
  @ApiQuery({ name: 'accion_hallazgo', required: false })
  @ApiQuery({ name: 'dependencia', required: false })
  @ApiQuery({ name: 'auditor', required: false })
  @ApiQuery({ name: 'desde', required: false, description: 'Cronograma desde (ISO).' })
  @ApiQuery({ name: 'hasta', required: false, description: 'Cronograma hasta (ISO).' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiResponse({ status: 200, description: 'Lista obtenida con éxito.' })
  @ApiResponse({ status: 404, description: 'Error en la consulta.' })
  async getAllAuditor(
    @Res() res: any,
    @Param('personaId', ParseIntPipe) personaId: number,
    @Query() queryParams: any,
  ) {
    try {
      const data = await this.gestionAccionesService.getAllAuditor(
        personaId,
        queryParams,
      );
      res.status(HttpStatus.OK).json(data);
    } catch (error) {
      res.status(HttpStatus.NOT_FOUND).json({
        Success: false,
        Status: HttpStatus.NOT_FOUND,
        Message: 'Error en servicio GetAllAuditor.',
        Data: error.message,
      });
    }
  }
}
