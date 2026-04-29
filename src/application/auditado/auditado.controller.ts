import { Controller, Get, HttpStatus, Param, Query, Res } from '@nestjs/common';
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
    explode: false,
    style: 'form',
  })
  async filtrarDocumentosPorDependencia(
    @Res() res: any,
    @Param('personaId') personaId: number,
    @Query('auditoria_id') auditoriaId: string,
    @Query('cargo_id') cargoId: number,
    @Query('tipo_documento_id') tipoDocumentoId?: string,
  ) {
    try {
      const data = await this.auditadoService.filtrarDocumentosPorDependencia(
        personaId,
        auditoriaId,
        cargoId,
        tipoDocumentoId,
      );
      return res.status(HttpStatus.OK).json(data);
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        Success: false,
        Status: HttpStatus.INTERNAL_SERVER_ERROR,
        Message: 'Error al filtrar los documentos',
        Data: error.message,
      });
    }
  }
}
