import { Controller, Get, Param, HttpStatus, Res, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { PlanEstadoService } from './plan-estado.service';

@ApiTags('Plan Estado')
@Controller('plan-estado')
export class PlanEstadoController {
  constructor(private readonly planEstadoService: PlanEstadoService) {}

  @Get()
  @ApiOperation({ summary: 'Obtiene todos los estados de planes.' })
  @ApiQuery({
    name: 'filter',
    required: false,
    description: 'Filtro opcional.',
  })
  @ApiResponse({ status: 200, description: 'Lista obtenida con éxito.' })
  @ApiResponse({ status: 404, description: 'No se encontraron estados.' })
  async getAll(@Res() res, @Query() queryParams) {
    try {
      const data = await this.planEstadoService.getAll(queryParams);
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
  @ApiOperation({ summary: 'Obtiene un estado de plan por ID.' })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'ID del estado del plan.',
  })
  @ApiResponse({ status: 200, description: 'Estado obtenido con éxito.' })
  @ApiResponse({ status: 404, description: 'No se encontró el estado.' })
  async getById(@Param('id') id: string) {
    return await this.planEstadoService.getOne(id);
  }
}
