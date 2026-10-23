import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FormulacionPlanesService } from './formulacion-planes.service';

@ApiTags('Formulación de Planes')
@Controller('plan-mejoramiento/formulacion')
export class FormulacionPlanesController {
  constructor(
    private readonly formulacionPlanesService: FormulacionPlanesService,
  ) {}

  @Get('auditado/:personaId/:cargoId/resumen')
  @ApiOperation({
    summary:
      'Conteos de auditorías finalizadas del auditado por estado de su plan de mejoramiento.',
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
  async getResumen(
    @Res() res: any,
    @Param('personaId', ParseIntPipe) personaId: number,
    @Param('cargoId', ParseIntPipe) cargoId: number,
    @Query() queryParams: any,
  ) {
    try {
      const data = await this.formulacionPlanesService.getResumen(
        personaId,
        cargoId,
        queryParams,
      );
      res.status(HttpStatus.OK).json(data);
    } catch (error) {
      res.status(HttpStatus.NOT_FOUND).json({
        Success: false,
        Status: HttpStatus.NOT_FOUND,
        Message: 'Error en servicio GetResumen.',
        Data: error.message,
      });
    }
  }

  @Get('auditado/:personaId/:cargoId')
  @ApiOperation({
    summary:
      'Lista las auditorías finalizadas del auditado con el estado, auditores, hallazgos y observaciones de su plan.',
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
    name: 'estado_ids',
    required: false,
    description: 'Estados del plan separados por coma.',
  })
  @ApiQuery({
    name: 'busqueda',
    required: false,
    description: 'Texto sobre dependencia o título.',
  })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiResponse({ status: 200, description: 'Lista obtenida con éxito.' })
  @ApiResponse({ status: 404, description: 'Error en la consulta.' })
  async getAll(
    @Res() res: any,
    @Param('personaId', ParseIntPipe) personaId: number,
    @Param('cargoId', ParseIntPipe) cargoId: number,
    @Query() queryParams: any,
  ) {
    try {
      const data = await this.formulacionPlanesService.getAll(
        personaId,
        cargoId,
        queryParams,
      );
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

  @Get('auditor/:personaId/resumen')
  @ApiOperation({
    summary:
      'Conteos de auditorías finalizadas que revisa el auditor, por estado de su plan de mejoramiento.',
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
      const data = await this.formulacionPlanesService.getResumenAuditor(
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
      'Lista las auditorías finalizadas que revisa el auditor con el estado, plazo y avance de dictamen de su plan.',
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
    name: 'estado_ids',
    required: false,
    description: 'Estados del plan separados por coma.',
  })
  @ApiQuery({
    name: 'busqueda',
    required: false,
    description: 'Texto sobre dependencia o título.',
  })
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
      const data = await this.formulacionPlanesService.getAllAuditor(
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
