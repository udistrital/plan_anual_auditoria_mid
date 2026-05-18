import { Controller, Get, HttpStatus, Param, Query, ParseIntPipe } from '@nestjs/common';
import { AuditadoService } from './auditado.service';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Auditado')
@Controller('auditado')
export class AuditadoController {
  constructor(private readonly auditadoService: AuditadoService) {}

  @Get(':personaId/documento')
  @ApiOperation({
    summary: 'Filtrar los documentos a visualizar para el auditado',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Documentos filtrados exitosamente.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No se encontraron documentos para el auditado.',
  })
  @ApiParam({
    name: 'personaId',
    required: true,
    description: 'ID del auditado para filtrar los documentos.',
  })
  @ApiQuery({
    name: 'auditoria_id',
    required: true,
    description: 'ID de la auditoría para filtrar los documentos.',
  })
  @ApiQuery({
    name: 'cargo_id',
    required: true,
    description: 'ID del cargo del auditado para filtrar los documentos.',
  })
  @ApiQuery({
    name: 'tipo_documento_id',
    required: false,
    description:
      'ID del tipo de documento para filtrar los documentos (opcional).',
  })
  async filtrarDocumentosPorDependencia(
    @Param('personaId', ParseIntPipe) personaId: number,
    @Query('auditoria_id') auditoriaId: string,
    @Query('cargo_id', ParseIntPipe) cargoId: number,
    @Query('tipo_documento_id') tipoDocumentoId?: string,
  ) {
    return this.auditadoService.filtrarDocumentosPorDependencia(
      personaId,
      auditoriaId,
      cargoId,
      tipoDocumentoId,
    );
  }
}