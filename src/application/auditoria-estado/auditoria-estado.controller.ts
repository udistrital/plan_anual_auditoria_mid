import { Controller, Get, Param, HttpStatus, Res, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { AuditoriaEstadoService } from './auditoria-estado.service';

@ApiTags('Auditoria Estado')
@Controller('auditoria-estado')
export class AuditoriaEstadoController {
  constructor(private readonly auditoriaEstadoService: AuditoriaEstadoService) {}

  @Get()
  @ApiOperation({ summary: 'Obtiene todos los estados de auditorías.' })
  @ApiQuery({
    name: 'filter',
    required: false,
    description: 'Filtro opcional.',
  })
  @ApiResponse({ status: 200, description: 'Lista obtenida con éxito.' })
  @ApiResponse({ status: 404, description: 'No se encontraron estados.' })
  async getAll(@Res() res: any, @Query() queryParams: any) {
    try {
      const data = await this.auditoriaEstadoService.getAll(queryParams);
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

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene un estado de auditoría por ID.' })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'ID del estado de la auditoría.',
  })
  @ApiResponse({ status: 200, description: 'Estado obtenido con éxito.' })
  @ApiResponse({ status: 404, description: 'No se encontró el estado.' })
  async getById(@Param('id') id: string) {
    return await this.auditoriaEstadoService.getOne(id);
  }
}
