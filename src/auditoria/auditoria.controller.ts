import { Controller, Get, Param, HttpStatus, Res, Query } from '@nestjs/common';
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

  @Get('ordenadas')
  @ApiOperation({ summary: 'Obtener auditorías ordenadas' })
  @ApiQuery({
    name: 'orderBy',
    required: false,
    description: 'Campo de orden.',
  })
  @ApiQuery({
    name: 'orderDirection',
    required: false,
    description: 'Dirección (ASC o DESC).',
  })
  @ApiResponse({ status: 200, description: 'Auditorías obtenidas.' })
  @ApiResponse({ status: 400, description: 'Parámetros inválidos.' })
  @ApiResponse({ status: 500, description: 'Error interno.' })
  async getAuditoriasOrdenadas(@Res() res, @Query() queryParams) {
    try {
      const data =
        await this.auditoriaService.getAuditoriasOrdenadas(queryParams);
      res.status(HttpStatus.OK).json(data);
    } catch (error) {
      res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
        Success: false,
        Status: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
        Message: 'Error en servicio ordenadas: parámetro inválido o sin datos.',
        Data: error.message,
      });
    }
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
  async getAll(@Res() res, @Query() queryParams) {
    try {
      const data = await this.auditoriaService.getAll(queryParams);
      res.status(HttpStatus.OK).json(data);
    } catch (error) {
      res.status(HttpStatus.NOT_FOUND).json({
        Success: false,
        Status: HttpStatus.NOT_FOUND,
        Message: 'Error en servicio GetAll: sin datos o parámetro inválido.',
        Data: error.message,
      });
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener auditoría por ID' })
  @ApiParam({ name: 'id', required: true, description: 'ID de auditoría.' })
  @ApiResponse({ status: 200, description: 'Auditoría obtenida.' })
  @ApiResponse({ status: 404, description: 'Auditoría no encontrada.' })
  async getById(@Param('id') id: string) {
    return await this.auditoriaService.getOne(id);
  }
}
