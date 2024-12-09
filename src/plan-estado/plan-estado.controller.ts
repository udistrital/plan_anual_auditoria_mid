import { Controller, Get, Param, HttpStatus, Res, Query } from '@nestjs/common';
import { PlanEstadoService } from './plan-estado.service';
@Controller('plan-estado')
export class PlanEstadoController {
  constructor(private readonly planEstadoService: PlanEstadoService) {}
  @Get()
  async getAll(@Res() res, @Query() queryParams) {
    try {
      const data = await this.planEstadoService.getAll(queryParams);
      res.status(HttpStatus.OK).json(data);
    } catch (error) {
      res.status(HttpStatus.NOT_FOUND).json({
        Success: false,
        Status: HttpStatus.NOT_FOUND,
        Message:
          'Error en servicio GetAll: la peticion contiene un parametro incorrecto o no existe un registro',
        Data: error.message,
      });
    }
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return await this.planEstadoService.getOne(id);
  }
}
