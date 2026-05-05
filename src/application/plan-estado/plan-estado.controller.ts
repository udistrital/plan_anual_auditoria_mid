import { Controller, Get, HttpStatus, Param, Query } from '@nestjs/common';
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
  @ApiResponse({ status: HttpStatus.OK, description: 'Lista obtenida con éxito.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No se encontraron estados.' })
  async getAll(@Query() queryParams: any) {
    return this.planEstadoService.getAll(queryParams);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene un estado de plan por ID.' })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'ID del estado del plan.',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Estado obtenido con éxito.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No se encontró el estado.' })
  async getById(@Param('id') id: string) {
    return this.planEstadoService.getOne(id);
  }
}
