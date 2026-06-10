import { Controller, Get, HttpStatus, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { PlanMejoramientoEstadoService } from './plan-mejoramiento-estado.service';

@ApiTags('Plan Mejoramiento Estado')
@Controller('plan-mejoramiento-estado')
export class PlanMejoramientoEstadoController {
  constructor(private readonly planMejoramientoEstadoService: PlanMejoramientoEstadoService) {}

  @Get()
  @ApiOperation({ summary: 'Obtiene todos los estados de planes de mejoramiento.' })
  @ApiQuery({
    name: 'filter',
    required: false,
    description: 'Filtro opcional.',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Lista obtenida con éxito.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No se encontraron estados.' })
  async getAll(@Query() queryParams: any) {
    return this.planMejoramientoEstadoService.getAll(queryParams);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene un estado de plan de mejoramiento por ID.' })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'ID del estado del plan de mejoramiento.',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Estado obtenido con éxito.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No se encontró el estado.' })
  async getById(@Param('id') id: string) {
    return this.planMejoramientoEstadoService.getOne(id);
  }
}
