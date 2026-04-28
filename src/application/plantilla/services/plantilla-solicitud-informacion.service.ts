import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as moment from 'moment';
import 'moment/locale/es';
import { environment } from 'src/config/configuration';
import { lastValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { capitalize, unirListaNombres } from 'src/utils/texto.utils';
import { AuditoriaService } from 'src/application/auditoria/auditoria.service';
import { PlantillasMidService } from 'src/shared/services/plantillas-mid/plantillas-mid.service';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud/auditoria-crud.service';
import { ParametrosService } from 'src/shared/services/parametros/parametros.service';

const {
  PLANTILLAS,
  TERCEROS_SERVICE,
  OIKOS_SERVICE,
  logoUDistritalOCI,
  contactoOCI,
  ID_DEPENDENCIA_OCI,
  CARGO
} = environment;

@Injectable()
export class PlantillaSolicitudInformacionService {
  constructor(
    private readonly httpService: HttpService,
    private readonly plantillasMidService: PlantillasMidService,
    private readonly auditoriaCrudService: AuditoriaCrudService,
    private readonly parametrosService: ParametrosService,
    private readonly auditoriaService: AuditoriaService
  ) {}

  async get(idAuditoria: string) {
    const auditoria = await this.auditoriaService.getOne(idAuditoria);
    const infoParaPlantilla = await this.organizarData(auditoria.Data);
    const baseRenderizado =
      await this.plantillasMidService.post('/v1/plantilla/renderizar', infoParaPlantilla);
    return baseRenderizado;
  }

  private async organizarData(auditoria: any) {
    const auditoriaPadre = auditoria;
    const dependenciaPrincipal = this.obtenerDependenciaPrincipal(auditoriaPadre?.dependencia_id);

    const [dependencias, vigencia, auditoriaOSeguimiento, auditores, jefeOci] =
      await Promise.all([
        this.obtenergrupoDependencias(auditoriaPadre.dependencia_id),
        this.parametrosService.get('parametro', auditoriaPadre.vigencia_id, null).then(data => data.Data),
        this.parametrosService.get('parametro', auditoriaPadre.tipo_evaluacion_id, null).then(data => data.Data),
        this.obtenerNombresAuditores(auditoria._id),
        this.obtenerJefeOci()
      ]);

    const infoParaPlantilla = {
      plantilla_id: PLANTILLAS.SOLICITUD_INFORMACION,
      data: {
        logoUDistrital: logoUDistritalOCI,
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

  private async obtenerNombresAuditores(auditoriaId: string): Promise<string> {
    const params = {
      query: `auditoria_id:${auditoriaId},activo:true`,
      fields: 'auditor_id',
      limit: '0'
    }
    const auditores = await this.auditoriaCrudService.traerDataCrud('auditor', null, params).then(data => data.Data);

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

  private async obtenerTerceroVinculado(idCargo: number, idDependencia: number | null) {
    if (idDependencia == null) {
      return null;
    }

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

  private obtenerDependenciaPrincipal(dependenciaId: number | number[]): number | null {
  if (Array.isArray(dependenciaId)) {
    return dependenciaId.length > 0 ? dependenciaId[0] : null;
  }

  return typeof dependenciaId === 'number' ? dependenciaId : null;
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
    const url = `${TERCEROS_SERVICE}vinculacion?query=DependenciaId:${ID_DEPENDENCIA_OCI},CargoId:${CARGO.JEFE_DEPENDENCIA_ID},Activo:true`;
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
            responsable: responsableDependencia?.NombreCompleto || 'No se encontró el responsable de la dependencia'
          });
        }
      } else {
        const dependencia = await this.obtenerDependencia(dependencias);
        const responsableDependencia = await this.obtenerTerceroVinculado(environment.CARGO.JEFE_DEPENDENCIA_ID, dependencias);

        respuestaDependencias.push({
          nombre: dependencia.Nombre,
          responsable: responsableDependencia?.NombreCompleto || 'No se encontró el responsable de la dependencia'
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
