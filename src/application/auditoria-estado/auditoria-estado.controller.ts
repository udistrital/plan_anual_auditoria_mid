import { Controller, Get, Param, Query, HttpStatus } from '@nestjs/common';
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
  constructor(
    private readonly auditoriaEstadoService: AuditoriaEstadoService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Obtiene todos los estados de auditorías.' })
  @ApiQuery({
    name: 'filter',
    required: false,
    description: 'Filtro opcional.',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Lista obtenida con éxito.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No se encontraron estados.' })
  async getAll(@Query() queryParams: any) {
    return this.auditoriaEstadoService.getAll(queryParams);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene un estado de auditoría por ID.' })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'ID del estado de la auditoría.',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Estado obtenido con éxito.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No se encontró el estado.' })
  async getById(@Param('id') id: string) {
    return this.auditoriaEstadoService.getOne(id);
  }
}