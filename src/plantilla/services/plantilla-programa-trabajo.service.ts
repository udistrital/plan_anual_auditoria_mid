import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import 'moment/locale/es';
import { PlantillaUtilsService } from '../../utils/plantilla.utils';
import { environment } from 'src/config/configuration';
import { lastValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';


const {
    PLAN_AUDITORIA_CRUD_SERVICE,
    PLANTILLAS,
} = environment;

@Injectable()
export class PlantillaProgramaTrabajoService {
    constructor(
        private readonly httpService: HttpService,
        private readonly plantillaUtils: PlantillaUtilsService,
    ) {}

    async get(idAuditoria: string) {
        const auditoria = await this.plantillaUtils.obtenerAuditoria(idAuditoria);
        const actividades = await this.obtenerActividades(idAuditoria);
        return 0;
    }

    private async obtenerActividades(idAuditoria: string) {
        let urlActividades = `${PLAN_AUDITORIA_CRUD_SERVICE}actividad?query=auditoria_id:${idAuditoria}&fields=titulo,fecha_inicio,fecha_fin&limit=0`;
        try {
            const responseActividades = await lastValueFrom(
                this.httpService.get(urlActividades),
            );
            return responseActividades.data.Data;
        } catch (error) {
            throw new HttpException(
                'Error al obtener los datos del servicio externo ',
                error,
            );
        }
    }
}
