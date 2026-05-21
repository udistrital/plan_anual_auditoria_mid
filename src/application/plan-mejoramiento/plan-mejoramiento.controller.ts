import { Controller, Get, HttpStatus, Res, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { PlanMejoramientoService } from './plan-mejoramiento.service';

@ApiTags('Plan Mejoramiento')
@Controller('plan-mejoramiento')
export class PlanMejoramientoController {
  constructor(private readonly planMejoramientoService: PlanMejoramientoService) {}

  @Get()
  @ApiOperation({ summary: 'Obtiene planes de mejoramiento con estado resuelto.' })
  @ApiQuery({ name: 'filter', required: false, description: 'Filtro opcional.' })
  @ApiResponse({ status: 200, description: 'Lista obtenida con éxito.' })
  @ApiResponse({ status: 404, description: 'No se encontraron registros.' })
  async getAll(@Res() res: any, @Query() queryParams: any) {
    try {
      const data = await this.planMejoramientoService.getAll(queryParams);
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
