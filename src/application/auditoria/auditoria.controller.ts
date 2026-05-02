import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  ParseIntPipe,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { AuditoriaService } from './auditoria.service';

@ApiTags('Auditoria')
@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get('auditor/:personaId')
  @ApiOperation({ summary: 'Obtener auditorías por auditor' })
  @ApiParam({
    name: 'personaId',
    required: true,
    description: 'ID del auditor.',
  })
  @ApiResponse({ status: 200, description: 'Auditorías obtenidas.' })
  @ApiResponse({ status: 404, description: 'Sin resultados.' })
  async getByAuditor(
    @Param('personaId') personaId: string,
    @Query() queryParams: any,
  ) {
    return this.auditoriaService.getByAuditor(
      personaId,
      queryParams,
    );
  }

  @Get('auditado/:personaId/:cargoId')
  @ApiOperation({
    summary: 'Obtener auditorías por dependencia del usuario auditado',
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
  @ApiResponse({ status: 200, description: 'Auditorías obtenidas.' })
  @ApiResponse({ status: 404, description: 'Sin resultados.' })
  async getByDependencia(
    @Param('personaId', ParseIntPipe) personaId: number,
    @Param('cargoId', ParseIntPipe) cargoId: number,
    @Query() queryParams: any,
  ) {
    return this.auditoriaService.getByDependencia(
      personaId,
      cargoId,
      queryParams,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las auditorías' })
  @ApiQuery({
    name: 'filter',
    required: false,
    description: 'Filtro opcional.',
  })
  @ApiResponse({ status: 200, description: 'Auditorías obtenidas.' })
  @ApiResponse({ status: 404, description: 'Sin resultados.' })
  async getAll(@Query() queryParams: any) {
    return this.auditoriaService.getAll(queryParams);
  }

  @Delete(':id/:planId')
  @ApiOperation({ summary: 'Eliminar auditoría lógicamente' })
  @ApiParam({ name: 'id', required: true, description: 'ID de auditoría.' })
  @ApiParam({
    name: 'planId',
    required: true,
    description: 'ID del plan de auditoría.',
  })
  @ApiResponse({ status: 200, description: 'Auditoría eliminada.' })
  @ApiResponse({ status: 400, description: 'Parámetros inválidos.' })
  @ApiResponse({ status: 500, description: 'Error interno.' })
  async delete(
    @Param('id') id: string,
    @Param('planId') planId: string,
  ) {
    return this.auditoriaService.deleteAuditoria(id, planId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener auditoría por ID' })
  @ApiParam({ name: 'id', required: true, description: 'ID de auditoría.' })
  @ApiResponse({ status: 200, description: 'Auditoría obtenida.' })
  @ApiResponse({ status: 404, description: 'Auditoría no encontrada.' })
  async getById(@Param('id') id: string) {
    return this.auditoriaService.getOne(id);
  }
}