import { Controller, Get, Param, Query, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { ActividadService } from './actividad.service';

@ApiTags('Actividad')
@Controller('actividad')
export class ActividadController {
  constructor(private readonly actividadService: ActividadService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener todas las actividades' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Actividades obtenidas.' })
  async getAll(@Query() queryParams: any) {
    return this.actividadService.getAll(queryParams);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener actividad por ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Actividad obtenida.' })
  @ApiParam({ name: 'id', required: true })
  async getById(@Param('id') id: string) {
    return this.actividadService.getOne(id);
  }
}