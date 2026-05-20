import { Controller, Get, HttpStatus, Res, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ResponsableAccionService } from './responsable-accion.service';

@ApiTags('Responsable Acción')
@Controller('responsable-accion')
export class ResponsableAccionController {
  constructor(private readonly responsableAccionService: ResponsableAccionService) {}

  @Get()
  @ApiOperation({ summary: 'Obtiene los responsables de acción con nombre de dependencia resuelto.' })
  @ApiQuery({ name: 'filter', required: false, description: 'Filtro opcional.' })
  @ApiResponse({ status: 200, description: 'Lista obtenida con éxito.' })
  @ApiResponse({ status: 404, description: 'No se encontraron registros.' })
  async getAll(@Res() res: any, @Query() queryParams: any) {
    try {
      const data = await this.responsableAccionService.getAll(queryParams);
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
}
