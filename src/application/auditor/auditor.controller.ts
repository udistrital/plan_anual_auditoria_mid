import { Controller, Get, Param, Query, HttpStatus, ParseIntPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { AuditorService } from './auditor.service';

@ApiTags('Auditor')
@Controller('auditor')
export class AuditorController {
  constructor(private readonly auditorService: AuditorService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener todos los auditores' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Auditores obtenidos.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Sin resultados.' })
  @ApiQuery({
    name: 'queryParams',
    required: false,
    description: 'Filtros opcionales.',
  })
  async getAll(@Query() queryParams: any) {
    return this.auditorService.getAll(queryParams);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener auditor por ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Auditor obtenido.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No encontrado.' })
  @ApiParam({ name: 'id', required: true, description: 'ID del auditor.' })
  async getById(@Param('id') id: string) {
    return this.auditorService.getOne(id);
  }
}