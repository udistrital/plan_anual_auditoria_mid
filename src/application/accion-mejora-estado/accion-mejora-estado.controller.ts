import { Controller, Get, HttpStatus, Res, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AccionMejoraEstadoService } from './accion-mejora-estado.service';

@ApiTags('Acción Mejora Estado')
@Controller('accion-mejora-estado')
export class AccionMejoraEstadoController {
  constructor(private readonly accionMejoraEstadoService: AccionMejoraEstadoService) {}

  @Get()
  @ApiOperation({ summary: 'Obtiene estados de acciones de mejora con estado resuelto.' })
  @ApiQuery({ name: 'query', required: false, description: 'Filtro opcional.' })
  @ApiResponse({ status: 200, description: 'Lista obtenida con éxito.' })
  @ApiResponse({ status: 404, description: 'No se encontraron registros.' })
  async getAll(@Res() res: any, @Query() queryParams: any) {
    try {
      const data = await this.accionMejoraEstadoService.getAll(queryParams);
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
