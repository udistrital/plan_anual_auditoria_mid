import { firstValueFrom } from 'rxjs';
import { Injectable } from '@nestjs/common';
import { AuditoriaService } from 'src/application/auditoria/auditoria.service';
import { environment } from 'src/config/configuration';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { NuxeoService } from 'src/shared/services/nuxeo.service';
import { OikosService } from 'src/shared/services/oikos.service';
import { PlantillasMidService } from 'src/shared/services/plantillas-mid.service';
import { TercerosHelperService } from 'src/shared/services/terceros-helper.service';
import { resolverDescripcionesTemas } from 'src/shared/utils/descripcion-nuxeo.util';

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
export class PlantillaInformeSeguimientoService {
  constructor(
    private readonly plantillasMidService: PlantillasMidService,
    private readonly auditoriaCrudService: AuditoriaCrudService,
    private readonly oikosService: OikosService,
    private readonly auditoriaService: AuditoriaService,
    private readonly tercerosService: TercerosHelperService,
    private readonly nuxeoService: NuxeoService,
  ) {}

  async get(idAuditoria: string) {
    const auditoria = await this.auditoriaService.getOne(idAuditoria);
    const inforParaPlantilla = await this.organizarData(auditoria.Data);
    const baseRenderizado = await this.plantillasMidService.post(
      '/v1/plantilla/renderizar',
      inforParaPlantilla,
    );
    return baseRenderizado;
  }

  private async organizarData(auditoria: any) {
    try {
      if (!auditoria?._id) {
        throw new Error('No se encontró la auditoría para generar la plantilla');
      }

      const informe = await this.obtenerInformeSeguimiento(auditoria._id);
      if (!informe?._id) {
        throw new Error('No se encontró el informe asociado a la auditoría');
      }

      const temas = await this.obtenerTemasInforme(informe._id);
      // Las descripciones con imágenes están en el gestor documental (NuxeoEnlace): se traen como HTML
      const temasProcesados = await resolverDescripcionesTemas(temas, (uuid) =>
        firstValueFrom(this.nuxeoService.obtenerPorUUID(uuid)),
      );
      const temasReestructurados =
        await this.reestructurarTemas(temasProcesados);
      const [anio, mes, dia] = (informe.fecha_emision ?? '').split('T')[0].split('-');
      const [
        tituloInforme,
        dependencias,
        lideres,
        responsables,
        jefeOci,
        auditores,
      ] = await Promise.all([
        // titulo informe
        this.generarTituloInforme(
          auditoria._id,
          auditoria.tipo_evaluacion_id,
          auditoria.titulo,
        ),
        // dependencias
        Promise.all(
          auditoria.dependencia_id.map((dependencia_id: number) =>
            this.oikosService.traerData('dependencia', dependencia_id, null),
          ),
        ),
        // lideres
        Promise.all(
          auditoria.dependencia_id.map((dependencia_id: number) =>
            this.tercerosService.getTerceroVinculado(
              dependencia_id,
              CARGO.JEFE_DEPENDENCIA_ID,
            ),
          ),
        ),
        // responsables
        Promise.all(
          auditoria.dependencia_id.map((dependencia_id: number) =>
            this.tercerosService.getTerceroVinculado(
              dependencia_id,
              CARGO.ASISTENTE_DEPENDENCIA_ID,
            ),
          ),
        ),
        // jefe oci
        this.tercerosService.getJefeOCI(),
        // auditores asignados (líder primero)
        this.obtenerAuditoresAsignados(auditoria._id),
      ]);
      const nombreJefeOci = jefeOci || SIN_JEFE_OCI;

      // Relacionar cada líder y responsable con su respectiva dependencia para evitar confusiones en la plantilla
      dependencias.forEach((dependencia: any, indice: number) => {
        if (dependencia?.Nombre)
          dependencia.Nombre += ` (${indice + 1})`;
      });
      lideres.forEach((lider: any, indice: number) => {
        if (lider?.NombreCompleto)
          lider.NombreCompleto += ` (${indice + 1})`;
      });
      responsables.forEach((responsable: any, indice: number) => {
        if (responsable?.NombreCompleto)
          responsable.NombreCompleto += ` (${indice + 1})`;
      });

      const infoParaPlantilla = {
        plantilla_id: PLANTILLAS.INFORME_SEGUIMIENTO,
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
            // Nombres que arma AuditoriaService.getOne desde macroproceso_id y proceso_id
            macroproceso: auditoria.macroproceso ?? '',
            proceso: auditoria.proceso ?? '',
            dependencia: dependencias
              .filter((mp: any) => mp)
              .map((mp: any) => mp.Nombre)
              .join(', '),
            lider: lideres
              .filter((l: any) => l)
              .map((l: any) => l.NombreCompleto)
              .join(', ') ?? '',
            responsable: responsables
              .filter((r: any) => r)
              .map((r: any) => r.NombreCompleto)
              .join(', ') ?? '',
            objetivo: auditoria.objetivo,
            alcance: auditoria.alcance,
            criterios: auditoria.criterio,
            muestra: informe.muestra,
          },
          aspectos_generales: informe.aspecto_general,
          temas: temasReestructurados,
          observaciones_conclusiones: informe.observacion_conclusion,
          notas: informe.nota,
          jefe_oci: nombreJefeOci,
          // Lo usa la plantilla anterior (tabla "Auditor Responsable"); se conserva mientras se despliega la nueva
          auditor_responsable: auditores[0]?.nombre ?? SIN_AUDITOR,
          // Tabla "Proyectó / Aprobó". Seguimiento solo tiene informe final, por eso se envía siempre
          elaboracion: {
            proyecto: auditores.length
              ? auditores
              : [{ nombre: SIN_AUDITOR, cargo: CARGO_AUDITOR }],
            aprobo: { nombre: nombreJefeOci, cargo: CARGO_JEFE_OCI },
          },
          es_preliminar: false,
        },
      };
      return infoParaPlantilla;
    } catch (error: any) {
      const newError = new Error(
        'Error al organizar los datos para la plantilla del informe de seguimiento',
      );
      newError.stack = error.stack;
      throw newError;
    }
  }

  private async obtenerInformeSeguimiento(idAuditoria: string) {
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

  private async obtenerTemasInforme(idInforme: string) {
    const params = {
      query: `informe_id:${idInforme},activo:true`,
      limit: 0,
    };
    const respuestaTemas = await this.auditoriaCrudService.traerDataCrud(
      'tema',
      null,
      params,
    );
    return respuestaTemas.Data;
  }

  private async generarTituloInforme(
    idAuditoria: string,
    tipo_evaluacion_id: number,
    auditoriaTitulo: string,
  ) {
    let titulo = '';

    if (tipo_evaluacion_id == TIPO_EVALUACION.AUDITORIA_INTERNA) {
      titulo += 'Auditoria Interna: ';
    } else {
      titulo += 'Auditoria de Seguimiento: ';
    }

    titulo += auditoriaTitulo;
    const params = {
      query: `auditoria_id:${idAuditoria},activo:true,actual:true`,
      limit: 1,
    };
    const estado_auditoria_id = await this.auditoriaCrudService
      .traerDataCrud('auditoria-estado', null, params)
      .then((data) => data.Data);

    if (ESTADOS_INFORME_AUDITORIA_PRELIMINAR.indexOf(estado_auditoria_id[0]) !== -1) {
      titulo += ' - Preliminar';
    } else {
      titulo += ' - Final';
    }
    return titulo;
  }

  private async reestructurarTemas(temas: any[]) {
    return temas.map(({ subtema, ...data }) => ({
      ...data,
      subtemas:
        subtema?.map(({ hallazgo, ...sub }) => ({
          ...sub,
          hallazgos: hallazgo ?? [],
        })) ?? [],
    }));
  }

  // Auditores activos de la auditoría, con el líder primero. Los que no aparecen en Terceros se omiten,
  // y una consulta fallida a Terceros no impide generar el informe
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
      ...auditores.filter((a) => a?.auditor_id && a.auditor_lider),
      ...auditores.filter((a) => a?.auditor_id && !a.auditor_lider),
    ];
    const terceros = await Promise.all(
      ordenados.map((a) =>
        this.tercerosService.getTerceroById(a.auditor_id).catch(() => null),
      ),
    );
    return ordenados
      .map((a, i) => ({
        nombre: terceros[i]?.NombreCompleto,
        cargo: a.auditor_lider ? CARGO_AUDITOR_LIDER : CARGO_AUDITOR,
      }))
      .filter((a): a is AuditorInforme => !!a.nombre);
  }
}
