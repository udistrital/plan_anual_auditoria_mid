import {
  Controller,
  Get,
  Delete,
  Param,
  HttpStatus,
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
import { AuditoriaPadreService } from './auditoria-padre.service';

@ApiTags('Auditoria Padre')
@Controller('auditoria-padre')
export class AuditoriaPadreController {
  constructor(private readonly auditoriaPadreService: AuditoriaPadreService) {}

  @Get('ordenadas')
  @ApiOperation({ summary: 'Obtener auditorías padre ordenadas' })
  @ApiQuery({
    name: 'plan_auditoria_id',
    required: true,
    description: 'ID del plan de auditoría (obligatorio).',
  })
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
  @ApiResponse({ status: 200, description: 'Auditorías padre obtenidas.' })
  @ApiResponse({ status: 400, description: 'Parámetros inválidos.' })
  @ApiResponse({ status: 500, description: 'Error interno.' })
  async getAuditoriasOrdenadas(@Res() res: any, @Query() queryParams: any) {
    try {
      const data =
        await this.auditoriaPadreService.getAuditoriasOrdenadas(queryParams);
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
  @ApiOperation({ summary: 'Obtener todas las auditorías padre' })
  @ApiQuery({
    name: 'filter',
    required: false,
    description: 'Filtro opcional.',
  })
  @ApiResponse({ status: 200, description: 'Auditorías padre obtenidas.' })
  @ApiResponse({ status: 404, description: 'Sin resultados.' })
  async getAll(@Res() res: any, @Query() queryParams: any) {
    try {
      const data = await this.auditoriaPadreService.getAll(queryParams);
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
  @ApiOperation({ summary: 'Obtener auditoría padre por ID' })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'ID de auditoría padre.',
  })
  @ApiResponse({ status: 200, description: 'Auditoría padre obtenida.' })
  @ApiResponse({ status: 404, description: 'Auditoría padre no encontrada.' })
  async getById(@Param('id') id: string) {
    return await this.auditoriaPadreService.getOne(id);
  }

  @Delete(':id/:planId')
  @ApiOperation({ summary: 'Eliminar auditoría padre lógicamente' })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'ID de auditoría padre.',
  })
  @ApiParam({
    name: 'planId',
    required: true,
    description: 'ID del plan de auditoría.',
  })
  @ApiResponse({ status: 200, description: 'Auditoría padre eliminada.' })
  @ApiResponse({ status: 400, description: 'Parámetros inválidos.' })
  @ApiResponse({ status: 500, description: 'Error interno.' })
  async delete(
    @Res() res: any,
    @Param('id') id: string,
    @Param('planId') planId: string,
  ) {
    try {
      const data = await this.auditoriaPadreService.deleteAuditoriaPadre(
        id,
        planId,
      );
      res.status(HttpStatus.OK).json(data);
    } catch (error) {
      res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
        Success: false,
        Status: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
        Message: 'Error al eliminar la auditoría padre.',
        Data: error.message,
      });
    }
  }
}
