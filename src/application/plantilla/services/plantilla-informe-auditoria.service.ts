import { firstValueFrom } from 'rxjs';
import { Injectable } from '@nestjs/common';
import { AuditoriaService } from 'src/application/auditoria/auditoria.service';
import { environment } from 'src/config/configuration';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { NuxeoService } from 'src/shared/services/nuxeo.service';
import { OikosService } from 'src/shared/services/oikos.service';
import { PlantillasMidService } from 'src/shared/services/plantillas-mid.service';
import { TercerosHelperService } from 'src/shared/services/terceros-helper.service';
import {
  resolverDescripcionesHallazgos,
  resolverDescripcionesTemas,
} from 'src/shared/utils/descripcion-nuxeo.util';
import { esHtmlVacio } from 'src/shared/utils/html.util';

const {
  PLANTILLAS,
  TIPO_EVALUACION,
  ESTADOS_INFORME_AUDITORIA_PRELIMINAR,
  CARGO,
  logoUDistrital,
  logoSIGUD
} = environment;

const SIN_AUDITOR = 'Sin auditor asignado.';
const SIN_JEFE_OCI =
  'No se encontró el jefe de la Oficina Asesora de Control Interno';
const CARGO_AUDITOR = 'Auditor';
const CARGO_AUDITOR_LIDER = 'Auditor líder';
const CARGO_JEFE_OCI = 'Jefe Oficina de Control Interno';

interface AuditorInforme {
  nombre: string;
  cargo: string;
}

@Injectable()
export class PlantillaInformeAuditoriaService {
  constructor(
    private readonly plantillasMidService: PlantillasMidService,
    private readonly auditoriaCrudService: AuditoriaCrudService,
    private readonly auditoriaService: AuditoriaService,
    private readonly tercerosService: TercerosHelperService,
    private readonly oikosService: OikosService,
    private readonly nuxeoService: NuxeoService
  ) {}

  async get(idAuditoria: string) {
    const auditoriaRespuesta = await this.auditoriaService.getOne(idAuditoria);
    const infoParaPlantilla = await this.organizarData({
      auditoria: auditoriaRespuesta?.Data || {},
    });
    return await this.plantillasMidService.post(
      '/v1/plantilla/renderizar',
      infoParaPlantilla,
    );
  }

  private async organizarData(dataAuditoria: any) {
    try {
      const auditoria = dataAuditoria.auditoria;
      if (!auditoria?._id) {
        throw new Error(
          'No se encontró la auditoría para generar la plantilla',
        );
      }

      const informe = await this.obtenerInformeAuditoria(auditoria._id);
      if (!informe?._id) {
        throw new Error('No se encontró el informe asociado a la auditoría');
      }

      const [temas, hallazgos] = await Promise.all([
        this.obtenerComponentesInforme('tema', informe._id),
        this.obtenerComponentesInforme('hallazgo' , informe._id),
      ]);

      const [temasProcesados, hallazgosProcesados] = await Promise.all([
        this.procesarDescripcionTemas(temas),
        this.procesarDescripcionHallazgos(hallazgos),
      ]);
      const temasReestructurados = await this.reestructurarTemas(
        temasProcesados,
        hallazgosProcesados,
      );
      const [anio, mes, dia] = informe.fecha_emision.split('T')[0].split('-');
      const esPreliminar = await this.esInformePreliminar(auditoria._id);
      const tituloInforme = this.generarTituloInforme(
        auditoria.tipo_evaluacion_id,
        auditoria.titulo,
        esPreliminar,
      );
      // En el informe preliminar no se expone el auditor responsable
      const [jefeOci, auditores, dependencias] = await Promise.all([
        this.tercerosService.getJefeOCI(),
        esPreliminar
          ? Promise.resolve([] as AuditorInforme[])
          : this.obtenerAuditoresAsignados(auditoria._id),
        this.obtenergrupoDependencias(auditoria.dependencia_id),
      ]);

      const infoParaPlantilla = {
        plantilla_id: PLANTILLAS.INFORME_AUDITORIA_INTERNA,
        data: {
          logoUDistrital: logoUDistrital,
          logoSIGUD: logoSIGUD,
          consecutivo: auditoria.consecutivo_no_auditoria,
          fecha_emision: {
            dia: dia,
            mes: mes,
            anio: anio,
          },
          informe: {
            titulo: tituloInforme,
            dependencias: dependencias,
            macroproceso: auditoria.macroproceso,
            proceso: auditoria.proceso,
            dependencia: auditoria.proceso_nombre[0] + ' / ' + auditoria.dependencia_nombre[0],
            lider: auditoria.datos_dependencias[0]?.jefe_nombre,
            responsable: auditoria.datos_dependencias[0]?.asistente_nombre,
            objetivo: auditoria.objetivo,
            alcance: auditoria.alcance,
            criterios: auditoria.criterio,
            muestra: informe.muestra,
          },
          aspectos_generales: informe.aspecto_general,
          temas: temasReestructurados,
          informe_final: (informe.informe_final),
          observaciones_conclusiones: informe.observacion_conclusion,
          notas: (informe.nota),
          jefe_oci: jefeOci || SIN_JEFE_OCI,
          auditor_responsable: esPreliminar
            ? ''
            : (auditores[0]?.nombre ?? SIN_AUDITOR),
          // Tabla "Proyectó / Aprobó": solo en el informe final
          elaboracion: esPreliminar
            ? null
            : {
                proyecto: auditores.length
                  ? auditores
                  : [{ nombre: SIN_AUDITOR, cargo: CARGO_AUDITOR }],
                aprobo: { nombre: jefeOci || SIN_JEFE_OCI, cargo: CARGO_JEFE_OCI },
              },
          es_preliminar: esPreliminar,
        },
      };
      return infoParaPlantilla;
    } catch (error: any) {
      const newError = new Error(
        'Error al organizar los datos para la plantilla del Informe de Auditoría',
      );
      newError.stack = error.stack;
      throw newError;
    }
  }

  private async obtenerInformeAuditoria(idAuditoria: string) {
    const params = {
      query: `auditoria_id:${idAuditoria},activo:true`,
      limit: 1,
    };
    const respuestaInforme = await this.auditoriaCrudService.traerDataCrud(
      'informe',
      null,
      params,
    );
    return respuestaInforme.Data[0];
  }

  private async obtenerComponentesInforme(tipo: string, idInforme: string) {
    const queryExtra = tipo === 'hallazgo' ? ',rechazado:false' : '';
    const params = {
      query: `informe_id:${idInforme},activo:true${queryExtra}`,
      limit: 0,
    };
    const respuesta = await this.auditoriaCrudService.traerDataCrud(
      tipo,
      null,
      params,
    );
    return respuesta.Data || [];
  }

  private generarTituloInforme(
    tipo_evaluacion_id: number,
    auditoriaTitulo: string,
    esPreliminar: boolean,
  ) {
    const tipo =
      tipo_evaluacion_id === TIPO_EVALUACION.AUDITORIA_INTERNA
        ? 'Auditoria Interna'
        : 'Auditoria de Seguimiento';

    const sufijo = esPreliminar ? 'Preliminar' : 'Final';

    return `${tipo}: ${auditoriaTitulo} - ${sufijo}`;
  }

  // Determina si el estado actual de la auditoría corresponde a un informe preliminar
  private async esInformePreliminar(idAuditoria: string): Promise<boolean> {
    const params = {
      query: `auditoria_id:${idAuditoria},activo:true,actual:true`,
      limit: 1,
    };
    const respuesta = await this.auditoriaCrudService.traerDataCrud(
      'auditoria-estado',
      null,
      params,
    );
    const estadoId = Number(respuesta?.Data?.[0]?.estado_id);
    return ESTADOS_INFORME_AUDITORIA_PRELIMINAR.includes(estadoId);
  }

  private async reestructurarTemas(temas: any[], hallazgos: any[]) {
    // La sección "1" del informe está reservada, por eso la numeración arranca en 2
    return temas.map(({ subtema, ...data }, indiceTema) => {
      let contadorSubtema = 0;
      return {
        ...data,
        descripcion_titulo: esHtmlVacio(data.descripcion_titulo)
          ? ''
          : data.descripcion_titulo,
        subtemas:
          subtema?.map((sub: any) => ({
            ...sub,
            // Número del subtema ({tema}.{subtema}), en el mismo formato que el de los hallazgos
            numero:
              sub.activo === false
                ? ''
                : `${indiceTema + 2}.${++contadorSubtema}`,
            descripcion: esHtmlVacio(sub.descripcion) ? '' : sub.descripcion,
            hallazgos: hallazgos.filter(
              (h) => h.subtema_id?.toString() === sub._id?.toString(),
            ),
          })) ?? [],
      };
    });
  }

  // Auditores activos de la auditoría, con el líder primero. Los que no aparecen en Terceros se omiten
  private async obtenerAuditoresAsignados(
    auditoriaId: string,
  ): Promise<AuditorInforme[]> {
    const params = {
      query: `auditoria_id:${auditoriaId},activo:true`,
      limit: 0,
    };
    const auditores: any[] = await this.auditoriaCrudService
      .traerDataCrud('auditor', null, params)
      .then((data) => data?.Data ?? []);
    const ordenados = [
      ...auditores.filter((a) => a.auditor_lider),
      ...auditores.filter((a) => !a.auditor_lider),
    ];
    const terceros = await Promise.all(
      ordenados.map((a) => this.tercerosService.getTerceroById(a.auditor_id)),
    );
    return ordenados
      .map((a, i) => ({
        nombre: terceros[i]?.NombreCompleto,
        cargo: a.auditor_lider ? CARGO_AUDITOR_LIDER : CARGO_AUDITOR,
      }))
      .filter((a): a is AuditorInforme => !!a.nombre);
  }

  private async obtenergrupoDependencias(dependencias: any): Promise<any> {
    const respuestaDependencias = [];

    if (Array.isArray(dependencias)) {
      for (const idDependencia of dependencias) {
        const dependencia = await this.oikosService
          .traerData('dependencia', idDependencia, null);
        const liderDependencia =
          await this.tercerosService.getTerceroVinculado(
            idDependencia,
            CARGO.JEFE_DEPENDENCIA_ID,
          );
        const responsableDependencia =
          await this.tercerosService.getTerceroVinculado(
            idDependencia,
            CARGO.ASISTENTE_DEPENDENCIA_ID,
          );

        respuestaDependencias.push({
          nombre: dependencia.Nombre,
          lider:
            liderDependencia?.NombreCompleto ||
            'No se encontró el líder de la dependencia',
          responsable:
            responsableDependencia?.NombreCompleto ||
            'No se encontró el responsable de la dependencia',
        });
      }
    } else {
      const dependencia = await this.oikosService
        .traerData('dependencia', dependencias, null);
      const liderDependencia = await this.tercerosService.getTerceroVinculado(
        dependencias,
        CARGO.JEFE_DEPENDENCIA_ID,
      );
      const responsableDependencia =
        await this.tercerosService.getTerceroVinculado(
          dependencias,
          CARGO.ASISTENTE_DEPENDENCIA_ID,
        );

      respuestaDependencias.push({
        nombre: dependencia.Nombre,
        lider:
          liderDependencia?.NombreCompleto ||
          'No se encontró el líder de la dependencia',
        responsable:
          responsableDependencia?.NombreCompleto ||
          'No se encontró el responsable de la dependencia',
      });
    }
    return respuestaDependencias;
  }

  // Deja en HTML la descripción de cada hallazgo (texto plano, HTML o NuxeoEnlace)
  private async procesarDescripcionHallazgos(hallazgos: any[]) {
    return resolverDescripcionesHallazgos(hallazgos, (uuid) =>
      firstValueFrom(this.nuxeoService.obtenerPorUUID(uuid)),
    );
  }

  // Reemplaza los NuxeoEnlace de las descripciones de temas y subtemas por su HTML del gestor documental
  private async procesarDescripcionTemas(temas: any[]) {
    return resolverDescripcionesTemas(temas, (uuid) =>
      firstValueFrom(this.nuxeoService.obtenerPorUUID(uuid)),
    );
  }
}
