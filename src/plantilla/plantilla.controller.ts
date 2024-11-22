import {  Controller, Get, Param  } from '@nestjs/common';
import {PlantillaService} from './plantilla.service'
@Controller('plantilla')
export class PlantillaController {
    constructor(private readonly plantillaService: PlantillaService) { }

    @Get(':id')
    async getById(@Param('id') id: string) {
        return await this.plantillaService.getOne(id);
    }
}
