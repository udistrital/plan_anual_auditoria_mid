import { Controller, Get, Param, HttpStatus, Res, Query } from '@nestjs/common';
import {AuditorService} from './auditor.service'

@Controller('auditor')
export class AuditorController {
    constructor(private readonly auditorService: AuditorService) { }

    @Get()
    async getAll(@Res() res, @Query() queryParams) {
        try {
            const data = await this.auditorService.getdAll(queryParams);
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
        return await this.auditorService.getOne(id);
    }
}