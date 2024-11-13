import { Module } from '@nestjs/common';
import {ActividadService} from './actividad.service'
import {ActividadController} from './actividad.controller'
import { HttpModule } from '@nestjs/axios';


@Module({
    imports: [HttpModule],
    controllers: [ActividadController],
    providers: [ActividadService]
})
export class ActividadModule {}


