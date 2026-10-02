import { Inject, Injectable } from '@nestjs/common';
import { AuditoriaService } from 'src/application/auditoria/auditoria.service';
import { environment } from 'src/config/configuration';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { OikosService } from 'src/shared/services/oikos.service';
import { ParametrosService } from 'src/shared/services/parametros.service';
import { PlantillasMidService } from 'src/shared/services/plantillas-mid.service';

const { PLANTILLAS, logoUDistrital, logoSIGUD } = environment;

const TIPOS_ACCION: Record<number, string> = {
  1: 'Preventiva',
  2: 'Correctiva',
};

/** CodigoAbreviacion del parámetro de fuente (tipo 170) → clave que espera la plantilla */
const CLAVES_FUENTE: Record<string, string> = {
  F_AUD_INT: 'auditoria_interna',
  F_AUD_EXT: 'auditoria_externa',
  F_PROD_NO_CONFR: 'producto_no_conforme',
  F_QUEJAS: 'quejas_reclamos',
  F_REV_DIR: 'revision_direccion',
  F_IND_PRC: 'indicadores_proceso',
  F_EVA_DES: 'evaluacion_desempeno',
  F_MEJ_CONT: 'mejoramiento_continuo',
};

/** Fila de la tabla de formulación: una por cada acción de mejora */
interface FilaAccion {
  numero: number;
  descripcion: string;
  causa: string;
  tipo_accion: string;
  accion_planteada: string;
  nombre_indicador: string;
  formula_indicador: string;
  meta: string;
  responsables: string;
  fecha_inicio: string;
  fecha_fin: string;
}

@Injectable()
export class PlantillaPlanMejoramientoService {
  constructor(
    private readonly plantillasMidService: PlantillasMidService,
    private readonly auditoriaCrudService: AuditoriaCrudService,
    private readonly auditoriaService: AuditoriaService,
    private readonly parametrosService: ParametrosService,
    private readonly oikosService: OikosService,
    @Inject('MOMENT') private readonly moment: any,
  ) {}

  async get(idAuditoria: string) {
    const auditoriaRespuesta = await this.auditoriaService.getOne(idAuditoria);
    const infoParaPlantilla = await this.organizarData(
      auditoriaRespuesta?.Data,
    );
    return await this.plantillasMidService.post(
      '/v1/plantilla/renderizar',
      infoParaPlantilla,
    );
  }

  private async organizarData(auditoria: any) {
    try {
      // Se valida que la auditoría exista antes de armar los datos
      if (!auditoria?._id) {
        throw new Error(
          'No se encontró la auditoría para generar la plantilla',
        );
      }

      // Se consulta el plan de mejoramiento una sola vez
      const plan = await this.obtenerPlanMejoramiento(auditoria._id);

      const [procesos, fuentes, filasAcciones] = await Promise.all([
        this.obtenerProcesos(auditoria.proceso_id),
        this.marcarFuente(plan?.fuente),
        this.obtenerFilasAcciones(auditoria._id, plan?._id),
      ]);
      const dependencias: any[] = auditoria.datos_dependencias ?? [];

      return {
        plantilla_id: PLANTILLAS.PLAN_MEJORAMIENTO,
        data: {
          logoUDistrital,
          logoSIGUD,
          proceso_responsable: procesos.map((p) => p.Nombre).join(', '),
          // Se descartan nombres vacíos para no dejar comas sueltas
          lider_proceso: this.unirNombres(
            dependencias.map((d) => d.jefe_nombre),
          ),
          gestor_proceso: this.unirNombres(
            dependencias.map((d) => d.dependencia_nombre),
          ),
          fecha: this.formatearFecha(auditoria.fecha_inicio, 'DD/MM/YY'),
          fuentes,
          hallazgos: filasAcciones,
        },
      };
    } catch (error: any) {
      const newError = new Error(
        'Error al organizar los datos para la plantilla de Plan de mejoramiento',
      );
      newError.stack = error.stack;
      throw newError;
    }
  }

  private async obtenerPlanMejoramiento(auditoriaId: string) {
    const planes = await this.consultarCrud(
      'plan-mejoramiento',
      `auditoria_id:${auditoriaId},activo:true`,
    );
    return planes[0];
  }

  private async obtenerProcesos(procesoIds: number | number[]): Promise<any[]> {
    // Se acepta un solo id o una lista, y se ignoran los vacíos
    const ids = [procesoIds].flat().filter(Boolean);
    const procesos = await Promise.all(
      ids.map((id) =>
        this.parametrosService
          .get('parametro', id, null)
          .then((respuesta) => respuesta.Data),
      ),
    );
    return procesos.filter(Boolean);
  }

  private async marcarFuente(
    fuenteId?: number,
  ): Promise<Record<string, string>> {
    // plan.fuente guarda el Id del parámetro, no su posición en la lista.
    // Si el plan no tiene fuente, no se marca ninguna casilla.
    if (!fuenteId) return {};

    const fuente = await this.parametrosService
      .get('parametro', fuenteId, null)
      .then((respuesta) => respuesta.Data);
    // La casilla se identifica por el código del parámetro (estable), no por su nombre
    const codigo = String(fuente?.CodigoAbreviacion ?? '').toUpperCase();
    const clave = CLAVES_FUENTE[codigo];
    return clave ? { [clave]: 'true' } : {};
  }

  private async obtenerFilasAcciones(
    auditoriaId: string,
    planId?: string,
  ): Promise<FilaAccion[]> {
    // Sin plan activo no hay acciones
    if (!planId) return [];

    // Acciones y responsables se traen en una sola consulta cada uno
    // (antes era una consulta por hallazgo, por acción y por responsable)
    const [hallazgos, acciones] = await Promise.all([
      // Se excluyen los hallazgos rechazados
      this.consultarCrud(
        'hallazgo',
        `auditoria_id:${auditoriaId},activo:true,rechazado:false`,
      ),
      this.consultarCrud(
        'accion-mejora',
        `plan_mejoramiento_id:${planId},activo:true`,
      ),
    ]);
    const responsables = acciones.length
      ? await this.consultarCrud(
          'responsable-accion',
          `accion_mejora_id__in:${acciones.map((a) => a._id).join('|')},activo:true`,
        )
      : [];
    const nombresDependencias = await this.obtenerNombresDependencias(
      responsables.map((r) => r.dependencia_id),
    );

    return hallazgos.flatMap((hallazgo, indice) =>
      acciones
        .filter((accion) => this.idDe(accion.hallazgo_id) === hallazgo._id)
        .map((accion) => ({
          numero: indice + 1,
          descripcion: hallazgo.descripcion,
          causa: hallazgo.criterio,
          // Acción sin tipo queda en blanco
          tipo_accion: TIPOS_ACCION[accion.tipo_id] ?? '',
          accion_planteada: accion.descripcion,
          nombre_indicador: accion.nombre_indicador,
          formula_indicador: accion.formula_indicador,
          meta: accion.meta,
          responsables: this.unirNombres(
            responsables
              .filter((r) => this.idDe(r.accion_mejora_id) === accion._id)
              .map((r) => nombresDependencias.get(r.dependencia_id)),
          ),
          fecha_inicio: this.formatearFecha(accion.fecha_inicio, 'DD/MM/YYYY'),
          fecha_fin: this.formatearFecha(accion.fecha_fin, 'DD/MM/YYYY'),
        })),
    );
  }

  private async obtenerNombresDependencias(
    dependenciaIds: number[],
  ): Promise<Map<number, string>> {
    // cada dependencia se consulta una sola vez y en paralelo
    const idsUnicos = [...new Set(dependenciaIds.filter(Boolean))];
    const dependencias = await Promise.all(
      idsUnicos.map((id) =>
        this.oikosService.traerData('dependencia', id, null),
      ),
    );
    return new Map(
      idsUnicos.map((id, i) => [id, dependencias[i]?.Nombre ?? '']),
    );
  }

  private async consultarCrud(endpoint: string, query: string): Promise<any[]> {
    // Limit 0 en todas las consultas; el CRUD devuelve solo 10 registros por defecto
    const respuesta = await this.auditoriaCrudService.traerDataCrud(
      endpoint,
      null,
      { query, limit: 0 },
    );
    return Array.isArray(respuesta?.Data) ? respuesta.Data : [];
  }

  /** Devuelve el id de una referencia, venga como texto o como documento poblado. */
  private idDe(referencia: any): string {
    return String(referencia?._id ?? referencia ?? '');
  }

  private unirNombres(nombres: string[]): string {
    return nombres.filter(Boolean).join(', ');
  }

  private formatearFecha(fecha: string | Date, formato: string): string {
    // Una fecha vacía o inválida queda en blanco (antes salía la fecha de hoy)
    if (!fecha) return '';
    const fechaMoment = this.moment(fecha);
    return fechaMoment.isValid() ? fechaMoment.format(formato) : '';
  }
}
