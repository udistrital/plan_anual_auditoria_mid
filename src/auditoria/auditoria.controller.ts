import {
  Controller,
  Get,
  Param,
  HttpStatus,
  Res,
  Query,
  HttpException,
} from '@nestjs/common';
import { AuditoriaService } from './auditoria.service';
@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}
  @Get()
  async getAll(@Res() res, @Query() queryParams) {
    try {
      const data = await this.auditoriaService.getdAll(queryParams);
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

  // Método para obtener un registro por ID
  @Get(':id')
  async getById(@Param('id') id: string) {
    return await this.auditoriaService.getOne(id);
  }
}
