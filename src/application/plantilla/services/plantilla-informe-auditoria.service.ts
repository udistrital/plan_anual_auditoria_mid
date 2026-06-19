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
export class PlantillaInformeAuditoriaService {
  constructor(
    private readonly plantillasMidService: PlantillasMidService,
    private readonly auditoriaCrudService: AuditoriaCrudService,
    private readonly auditoriaService: AuditoriaService,
    private readonly tercerosService: TercerosHelperService,
    private readonly oikosService: OikosService,
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

      const temasReestructurados = await this.reestructurarTemas(temas, hallazgos);
      const [anio, mes, dia] = informe.fecha_emision.split('T')[0].split('-');
      const [tituloInforme, jefeOci, auditorResponsable, dependencias] =
        await Promise.all([
          this.generarTituloInforme(
            auditoria._id,
            auditoria.tipo_evaluacion_id,
            auditoria.titulo,
          ),
          this.tercerosService.getJefeOCI(),
          this.obtenerAuditorResponsable(auditoria._id),
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
          jefe_oci:
            jefeOci ||
            'No se encontró el jefe de la Oficina Asesora de Control Interno',
          auditor_responsable: auditorResponsable,
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

  private async generarTituloInforme(
    idAuditoria: string,
    tipo_evaluacion_id: number,
    auditoriaTitulo: string,
  ) {
    const tipo =
      tipo_evaluacion_id === TIPO_EVALUACION.AUDITORIA_INTERNA
        ? 'Auditoria Interna'
        : 'Auditoria de Seguimiento';

    const params = {
      query: `auditoria_id:${idAuditoria},activo:true,actual:true`,
      limit: 1,
    };
    const estado_id = await this.auditoriaCrudService
      .traerDataCrud('auditoria-estado', null, params)
      .then((data) => data.Data);

    const sufijo = ESTADOS_INFORME_AUDITORIA_PRELIMINAR.includes(estado_id)
      ? 'Preliminar'
      : 'Final';

    return `${tipo}: ${auditoriaTitulo} - ${sufijo}`;
  }

  private async reestructurarTemas(temas: any[], hallazgos: any[]) {
    return temas.map(({ subtema, ...data }) => ({
      ...data,
      subtemas:
        subtema?.map((sub: any ) => ({
          ...sub,
          hallazgos: hallazgos.filter((h) => h.subtema_id?.toString() === sub._id?.toString()),
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
}
