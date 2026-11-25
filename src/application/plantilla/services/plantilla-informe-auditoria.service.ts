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
  resolverTextoEnriquecido,
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

      // Respuestas de las dependencias por hallazgo (issue #958)
      const respuestasPorHallazgo = await this.obtenerRespuestasPorHallazgo(hallazgos);

      const [temasProcesados, hallazgosProcesados] = await Promise.all([
        this.procesarDescripcionTemas(temas),
        this.procesarDescripcionHallazgos(hallazgos),
      ]);
      const temasReestructurados = await this.reestructurarTemas(    
        temasProcesados,
        hallazgosProcesados,
        respuestasPorHallazgo,
      );
      const esPreliminar = await this.esInformePreliminar(auditoria._id);
      // Fecha de emisión según el tipo de informe (issue #958): la preliminar usa fecha_emision,
      // la final usa fecha_emision_final. No se sustituye una por la otra.
      const [anio, mes, dia] = this.seleccionarFechaEmision(informe, esPreliminar);
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
          // Sección "Informe Final" eliminada por issue #958: se deja de enviar el campo
          // informe_final a la plantilla. Se conserva en el modelo del informe (CRUD) por
          // compatibilidad con registros existentes. Para reactivarla, restaurar la línea:
          //   informe_final: (informe.informe_final),
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
      // Se conserva el motivo original en el log para diagnóstico (el 500 al cliente es genérico)
      console.error(
        'Error al organizar los datos para la plantilla del Informe de Auditoría:',
        error?.message ?? error,
      );
      const newError = new Error(
        `Error al organizar los datos para la plantilla del Informe de Auditoría: ${error?.message ?? error}`,
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

  /**
   * Devuelve [año, mes, dia] de la fecha de emisión según el tipo de informe (issue #958).
   * - Preliminar: usa informe.fecha_emision.
   * - Final: usa informe.fecha_emision_final; si no existe, hace respaldo con fecha_emision.
   *
   * La fecha de emisión final es OPCIONAL: el Jefe OCI puede aprobar sin fijarla (modal del front).
   * Cuando no está, el informe final se genera con la fecha preliminar como respaldo, de modo que
   * el documento siempre sea consultable/generable (incluye registros anteriores al issue #958).
   */
  private seleccionarFechaEmision(
    informe: any,
    esPreliminar: boolean,
  ): [string, string, string] {
    const fecha = esPreliminar
      ? informe.fecha_emision
      : (informe.fecha_emision_final ?? informe.fecha_emision);

    if (!fecha) {
      throw new Error('El informe no tiene fecha de emisión');
    }

    const [anio, mes, dia] = String(fecha).split('T')[0].split('-');
    return [anio, mes, dia];
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

  private async reestructurarTemas(
    temas: any[],
    hallazgos: any[],
    respuestasPorHallazgo: Map<string, any[]>,
  ) {
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
            hallazgos: hallazgos
              .filter((h) => h.subtema_id?.toString() === sub._id?.toString())
              .map((h) => ({
                ...h,
                // Respuestas de las dependencias de este hallazgo (issue #958)
                respuestas: respuestasPorHallazgo.get(h._id?.toString()) ?? [],
              })),
          })) ?? [],
      };
    });
  }

  /**
   * Construye, por hallazgo, la lista de respuestas de las dependencias (issue #958).
   * Cada respuesta se encabeza con "Respuesta <Nombre de la dependencia>", resuelta desde la
   * dependencia asociada a la observación. El contenido se resuelve desde Nuxeo si trae imágenes.
   * Solo se incluyen observaciones que tengan dependencia asociada; así no se mezclan con la del
   * auditor ni se atribuyen a quien genera el documento.
   */
  private async obtenerRespuestasPorHallazgo(
    hallazgos: any[],
  ): Promise<Map<string, any[]>> {
    const resultado = new Map<string, any[]>();
    const ids = (hallazgos ?? [])
      .map((h) => h._id?.toString())
      .filter((id): id is string => !!id);
    if (!ids.length) return resultado;

    // Las respuestas son un añadido al informe: si fallan, el documento debe generarse igual.
    let observaciones: any[] = [];
    try {
      const params = {
        query: `hallazgo_id__in:${ids.join('|')},activo:true`,
        limit: 0,
      };
      const respuesta = await this.auditoriaCrudService.traerDataCrud(
        'observacion',
        null,
        params,
      );
      observaciones = respuesta?.Data ?? [];
    } catch (error) {
      console.error(
        'No se pudieron obtener las observaciones para las respuestas por dependencia:',
        error,
      );
      return resultado;
    }

    const cacheDependencia = new Map<number, string>();

    for (const obs of observaciones) {
      const dependenciasIds: number[] = Array.isArray(obs.dependencia_id)
        ? obs.dependencia_id
        : [];
      // Sin dependencia asociada (p. ej. observación del auditor): no es respuesta de dependencia
      if (!dependenciasIds.length) continue;

      const hallazgoId: string = obs.hallazgo_id?.toString();
      if (!hallazgoId) continue;

      let contenido = '';
      try {
        contenido = await resolverTextoEnriquecido(obs.observacion, (uuid) =>
          firstValueFrom(this.nuxeoService.obtenerPorUUID(uuid)),
        );
      } catch (error) {
        console.error(
          `No se pudo resolver el contenido de una observación del hallazgo ${hallazgoId}:`,
          error,
        );
        continue;
      }
      if (esHtmlVacio(contenido)) continue;

      for (const dependenciaId of dependenciasIds) {
        const nombre = await this.nombreDependencia(
          dependenciaId,
          cacheDependencia,
        );
        const lista = resultado.get(hallazgoId) ?? [];
        lista.push({
          dependencia_id: dependenciaId,
          encabezado: `Respuesta ${nombre}`,
          contenido,
        });
        resultado.set(hallazgoId, lista);
      }
    }

    return resultado;
  }

  /** Nombre de la dependencia por id, con caché para no repetir llamadas a Oikos. */
  private async nombreDependencia(
    dependenciaId: number,
    cache: Map<number, string>,
  ): Promise<string> {
    if (cache.has(dependenciaId)) return cache.get(dependenciaId)!;
    let nombre = `Dependencia ${dependenciaId}`;
    try {
      const dependencia = await this.oikosService.traerData(
        'dependencia',
        dependenciaId,
        null,
      );
      if (dependencia?.Nombre) nombre = dependencia.Nombre;
    } catch (error) {
      console.error(
        `No se pudo obtener el nombre de la dependencia ${dependenciaId}:`,
        error,
      );
    }
    cache.set(dependenciaId, nombre);
    return nombre;
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
