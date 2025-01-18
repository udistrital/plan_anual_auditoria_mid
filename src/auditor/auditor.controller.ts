import { Controller, Get, Param, HttpStatus, Res, Query } from '@nestjs/common';
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
  async getAll(@Res() res, @Query() queryParams) {
    try {
      const data = await this.auditorService.getAll(queryParams);
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
  @ApiOperation({ summary: 'Obtener auditor por ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Auditor obtenido.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No encontrado.' })
  @ApiParam({ name: 'id', required: true, description: 'ID del auditor.' })
  async getById(@Param('id') id: string) {
    return await this.auditorService.getOne(id);
  }
}
