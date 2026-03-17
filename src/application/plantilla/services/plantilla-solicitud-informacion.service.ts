import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as moment from 'moment';
import 'moment/locale/es';
import { PlantillaUtilsService } from '../../../utils/plantilla.utils';
import { environment } from 'src/config/configuration';
import { lastValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { capitalize, unirListaNombres } from 'src/utils/texto.utils';
import { AuditoriaService } from 'src/application/auditoria/auditoria.service';

const {
  PLAN_AUDITORIA_CRUD_SERVICE,
  PLANTILLAS,
  PARAMETROS_SERVICE,
  TERCEROS_SERVICE,
} = environment;

@Injectable()
export class PlantillaSolicitudInformacionService {
  constructor(
    private readonly httpService: HttpService,
    private readonly plantillaUtils: PlantillaUtilsService,
    private readonly auditoriaService: AuditoriaService
  ) {}

  async get(idAuditoria: string) {
    const auditoria = await this.plantillaUtils.obtenerAuditoria(idAuditoria);
    const infoParaPlantilla = await this.organizarData(auditoria);
    const baseRenderizado =
      await this.plantillaUtils.renderizarPlantilla(infoParaPlantilla);
    return baseRenderizado;
  }

  private async organizarData(data: any) {
    const auditoria = data.auditoria;
    const [Lider, vigencia, auditoriaOSeguimiento, auditores] =
      await Promise.all([
        this.obtenerTerceroVinculado(environment.CARGO.JEFE_DEPENDENCIA_ID, auditoria.dependencia_id),
        this.traerParametros(auditoria.tipo_evaluacion_id),
        this.traerParametros(auditoria.tipo_evaluacion_id),
        this.obtenerNombresAuditores(auditoria._id),
      ]);

    const infoParaPlantilla = {
      plantilla_id: PLANTILLAS.SOLICITUD_INFORMACION,
      data: {
        fecha: moment().locale('es').format('D [de] MMMM [de] YYYY'),
        oci: auditoria.consecutivo_OCI,
        ie: auditoria.consecutivo_IE,
        nombreIngeniero: Lider?.NombreCompleto || '',
        ciudad: 'Bogotá D.C.',
        referencia: auditoria.titulo,
        anoAuditoria: vigencia.Nombre,
        auditoriaOSeguimiento: auditoriaOSeguimiento.Nombre,
        auditores: auditores,
        temas: [
          'Políticas de control interno',
          'Cumplimiento normativo',
          'Análisis de riesgos',
        ], //quemado
        imgFirmaTabla: 'https://example.com/signature-image.png',
      },
    };

    return infoParaPlantilla;
  }

  private async traerParametros(idParam: string) {
    const url = `${PARAMETROS_SERVICE}/parametro?query=Id:${idParam}&fields=Nombre`;
    try {
      const response = await lastValueFrom(this.httpService.get(url));
      return response.data.Data[0];
    } catch (error) {
      throw new HttpException(
        'Error al obtener los datos del servicio externo',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async obtenerNombresAuditores(auditoriaId: string): Promise<string> {
    const auditores = await this.traerAuditores(auditoriaId);

    if (!auditores?.length) return 'No se encontraron auditores.';

    const nombres = await Promise.all(
      auditores.map(async (auditor) => {
        try {
          const tercero = await this.traerTercero(auditor.auditor_id);
          return tercero?.NombreCompleto
            ? capitalize(tercero.NombreCompleto)
            : null;
        } catch (error) {
          console.error(
            `Error al obtener tercero ${auditor.auditor_id}:`,
            error,
          );
          return null;
        }
      }),
    );

    const todosValidos = nombres.every((nombre) => nombre !== null);

    if (!todosValidos) {
      return 'Error al obtener los nombres de los auditores';
    }

    return unirListaNombres(nombres);
  }

  private async traerAuditores(auditoriaId: string) {
    const url = `${PLAN_AUDITORIA_CRUD_SERVICE}auditor?query=auditoria_id:${auditoriaId},activo:true&limit=0&fields=auditor_id`;
    try {
      const response = await lastValueFrom(this.httpService.get(url));
      return response.data.Data;
    } catch (error) {
      throw new HttpException(
        'Error al obtener los datos de terceros',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async traerTercero(terceroId: number) {
    const url = `${TERCEROS_SERVICE}/tercero/${terceroId}`;
    try {
      const response = await lastValueFrom(this.httpService.get(url));
      return response.data;
    } catch (error) {
      throw new HttpException(
        'Error al obtener los datos de terceros',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async obtenerTerceroVinculado(idCargo: number, idDependencia: number) {
        try {
            const datosPersona = await this.auditoriaService.traerTerceroVinculado(idDependencia, idCargo);
            return datosPersona;
        } catch (error) {
            throw new HttpException(
                'Error al obtener los datos del tercero vinculado',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
