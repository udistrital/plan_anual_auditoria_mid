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
  
  constructor(private readonly auditoriaService: AuditoriaService) { }

  @Get('ordenadas')
  async getAuditoriasOrdenadas(@Res() res, @Query() queryParams) {
    try {
      const data = await this.auditoriaService.getAuditoriasOrdenadas(queryParams);
      res.status(HttpStatus.OK).json(data);
    } catch (error) {
      res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
        Success: false,
        Status: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
        Message: 'Error en servicio ordenadas: la peticion contiene un parametro incorrecto o no existe un registro',
        Data: error.message,
      });
    }
  }
  
  @Get()
  async getAll(@Res() res, @Query() queryParams) {
    try {
      const data = await this.auditoriaService.getAll(queryParams);
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
