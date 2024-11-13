import { Controller, Get, Param, HttpStatus, Res, Query } from '@nestjs/common';
import { PlanAuditoriaService } from './plan-auditoria.service';

@Controller('plan-auditoria')
export class PlanAuditoriaController {
    constructor(private readonly planAuditoriaService: PlanAuditoriaService) { }

    // Método para obtener todos los registros
    @Get()
    async getAll(@Res() res, @Query() queryParams) {
        try {
            const data = await this.planAuditoriaService.getdAll(queryParams);
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
        return await this.planAuditoriaService.getOne(id);
    }

}
