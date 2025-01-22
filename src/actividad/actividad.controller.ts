import { Controller, Get, Param, HttpStatus, Res, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { ActividadService } from './actividad.service';

@ApiTags('Actividad')
@Controller('actividad')
export class ActividadController {
  constructor(private readonly auditoriaService: ActividadService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener todas las actividades' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Actividades obtenidas.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Sin resultados.' })
  @ApiQuery({
    name: 'queryParams',
    required: false,
    description: 'Filtros opcionales.',
  })
  async getAll(@Res() res, @Query() queryParams) {
    try {
      const data = await this.auditoriaService.getAll(queryParams);
      res.status(HttpStatus.OK).json(data);
    } catch (error) {
      res.status(HttpStatus.NOT_FOUND).json({
        Success: false,
        Status: HttpStatus.NOT_FOUND,
        Message:
          'Error en servicio GetAll: parámetro inválido o sin registros.',
        Data: error.message,
      });
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener actividad por ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Actividad obtenida.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No encontrada.' })
  @ApiParam({ name: 'id', required: true, description: 'ID de la actividad.' })
  async getById(@Param('id') id: string) {
    return await this.auditoriaService.getOne(id);
  }
}
