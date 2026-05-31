import { Injectable } from '@nestjs/common';
import { AuditoriaService } from 'src/application/auditoria/auditoria.service';
import { environment } from 'src/config/configuration';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { OikosService } from 'src/shared/services/oikos.service';
import { PlantillasMidService } from 'src/shared/services/plantillas-mid.service';
import { TercerosHelperService } from 'src/shared/services/terceros-helper.service';

const {
  PLANTILLAS,
  TIPO_EVALUACION,
  ESTADOS_INFORME_AUDITORIA_PRELIMINAR,
  CARGO,
  logoUDistrital,
  logoSIGUD
} = environment;

@Injectable()
export class PlantillaInformeSeguimientoService {
  constructor(
    private readonly plantillasMidService: PlantillasMidService,
    private readonly auditoriaCrudService: AuditoriaCrudService,
    private readonly oikosService: OikosService,
    private readonly auditoriaService: AuditoriaService,
    private readonly tercerosService: TercerosHelperService,
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
      const temasReestructurados = await this.reestructurarTemas(temas);
      const [anio, mes, dia] = (informe.fecha_emision ?? '').split('T')[0].split('-');
      const [
        tituloInforme,
        dependencias,
        lideres,
        responsables,
        jefeOci,
        auditorResponsable,
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
        // auditor responsable
        this.obtenerAuditorResponsable(auditoria._id),
      ]);

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
          aspectos_generales: this.normalizarTextoEditor(informe.aspecto_general),
          temas: temasReestructurados,
          observaciones_conclusiones: this.normalizarTextoEditor(informe.observacion_conclusion),
          notas: this.normalizarTextoEditor(informe.nota),
          jefe_oci:
            jefeOci ||
            'No se encontró el jefe de la Oficina Asesora de Control Interno',
          auditor_responsable: auditorResponsable,
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

  private normalizarTextoEditor(valor: string | null | undefined): string {
    if (!valor) return '';
    return valor
      .replace(/&nbsp;/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>\s*<p>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+\n/g, '\n')
      .replace(/\n\s+/g, '\n')
      .trim();
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

  private async obtenerAuditorResponsable(
    auditoriaId: string,
  ): Promise<string> {
    const params = {
      query: `auditoria_id:${auditoriaId},activo:true`,
      limit: 0,
    };
    const auditores = await this.auditoriaCrudService
      .traerDataCrud('auditor', null, params)
      .then((data) => data.Data);
    switch (auditores.length) {
      case 0:
        return 'Sin auditor asignado.';
      case 1:
        return (await this.tercerosService.getTerceroById(
            auditores[0].auditor_id,
          ))?.NombreCompleto || 'Sin auditor asignado.';
      default:
        return (await this.tercerosService.getTerceroById(
            auditores.find((a) => a.auditor_lider)?.auditor_id
              || auditores[0]?.auditor_id,
          ))?.NombreCompleto || 'Sin auditor asignado.';
    }
  }
}
