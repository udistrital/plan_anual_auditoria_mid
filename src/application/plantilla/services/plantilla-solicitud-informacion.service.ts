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
  OIKOS_SERVICE,
  logoUDistrital,
  contactoOCI,
  ID_DEPENDENCIA_OCI,
  ID_CARGO_OCI
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
    const auditoriaPadreRespuesta = await this.auditoriaService.getAll({query: `_id:${auditoria.auditoria_padre_id}`});
    const auditoriaPadre = auditoriaPadreRespuesta.Data[0];

    const [dependencias, vigencia, auditoriaOSeguimiento, auditores, jefeOci] =
      await Promise.all([
        this.obtenergrupoDependencias(auditoriaPadre.dependencia_id),
        this.traerParametros(auditoriaPadre.vigencia_id),
        this.traerParametros(auditoriaPadre.tipo_evaluacion_id),
        this.obtenerNombresAuditores(auditoria._id),
        this.obtenerJefeOci()
      ]);

    const infoParaPlantilla = {
      plantilla_id: PLANTILLAS.SOLICITUD_INFORMACION,
      data: {
        logoUDistrital: logoUDistrital,
        fecha: moment().locale('es').format('D [de] MMMM [de] YYYY'),
        fecha_inicio: moment(auditoria.fecha_inicio).locale('es').format('DD/MM/YYYY'),
        consecutivo_oci: auditoria.consecutivo_OCI,
        dependencias: dependencias,
        ciudad: 'Bogotá D.C.',
        referencia: auditoriaOSeguimiento.Nombre + " - " + auditoriaPadre.titulo,
        anoAuditoria: vigencia.Nombre,
        tipo_auditoria: auditoriaOSeguimiento.Nombre,
        auditores: auditores,
        tema: auditoria.tema,
        jefe_oci: jefeOci || "No se encontró el jefe de la Oficina Asesora de Control Interno",
        contacto_oci: contactoOCI
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
  
  private async obtenerDependencia(idDependencia: string) {
    const url = `${OIKOS_SERVICE}dependencia/${idDependencia}`;
    try {
        const response = await lastValueFrom(this.httpService.get(url));
        return response.data;
    } catch (error) {
        throw new HttpException(
            'Error al obtener los datos de la dependencia',
            HttpStatus.INTERNAL_SERVER_ERROR,
        );
    }
  }

  private async obtenerJefeOci() {
    const url = `${TERCEROS_SERVICE}vinculacion?query=DependenciaId:${ID_DEPENDENCIA_OCI},CargoId:${ID_CARGO_OCI},Activo:true`;
    try {
        const response = await lastValueFrom(this.httpService.get(url)); 
        return response.data[0].TerceroPrincipalId.NombreCompleto;
    } catch (error) {
        throw new HttpException(
            'Error al obtener los datos de terceros',
            HttpStatus.INTERNAL_SERVER_ERROR,
        );
    }
  }

  private async obtenergrupoDependencias(dependencias: any): Promise<any> {
    const respuestaDependencias = [];

    try {
      if (Array.isArray(dependencias)) {
        for (const idDependencia of dependencias) {
          const dependencia = await this.obtenerDependencia(idDependencia);
          const responsableDependencia = await this.obtenerTerceroVinculado(environment.CARGO.JEFE_DEPENDENCIA_ID, idDependencia);

          respuestaDependencias.push({
            nombre: dependencia.Nombre,
            responsable: responsableDependencia?.nombre || 'No se encontró el responsable de la dependencia'
          });
        }
      } else {
        const dependencia = await this.obtenerDependencia(dependencias);
        const responsableDependencia = await this.obtenerTerceroVinculado(environment.CARGO.JEFE_DEPENDENCIA_ID, dependencias);

        respuestaDependencias.push({
          nombre: dependencia.Nombre,
          responsable: responsableDependencia?.nombre || 'No se encontró el responsable de la dependencia'
        });
      }
      return respuestaDependencias;
    } catch (error) {
      throw new HttpException(
            'Error al consultar el grupo de dependencias',
            HttpStatus.INTERNAL_SERVER_ERROR,
        );
    }
  }
}
