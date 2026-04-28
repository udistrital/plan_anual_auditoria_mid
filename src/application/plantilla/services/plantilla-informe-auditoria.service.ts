import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AuditoriaService } from 'src/application/auditoria/auditoria.service';
import { environment } from 'src/config/configuration';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud/auditoria-crud.service';
import { OikosService } from 'src/shared/services/oikos/oikos.service';
import { PlantillasMidService } from 'src/shared/services/plantillas-mid/plantillas-mid.service';
import { TercerosHelperService } from 'src/shared/services/terceros/terceros-helper.service';

const {
    PLANTILLAS,
    TIPO_EVALUACION,
    ESTADOS_INFORME_AUDITORIA_PRELIMINAR,
    CARGO,
} = environment;

@Injectable()
export class PlantillaInformeAuditoriaService {
    constructor(
        private readonly plantillasMidService: PlantillasMidService,
        private readonly auditoriaCrudService: AuditoriaCrudService,
        private readonly auditoriaService: AuditoriaService,
        private readonly tercerosService: TercerosHelperService,
        private readonly oikosService: OikosService,
    ) { }

    async get(idAuditoria: string) {
        const auditoriaRespuesta = await this.auditoriaService.getOne(idAuditoria);
        const infoParaPlantilla = await this.organizarData({ auditoria: auditoriaRespuesta?.Data || {} });
        return await this.plantillasMidService.post('/v1/plantilla/renderizar', infoParaPlantilla);
    }

    private async organizarData(dataAuditoria: any) {
        try {
            const auditoria = dataAuditoria.auditoria;
            if (!auditoria?._id) {
                throw new Error('No se encontró la auditoría para generar la plantilla');
            }

            const informe = await this.obtenerInformeAuditoria(auditoria._id);
            if (!informe?._id) {
                throw new Error('No se encontró el informe asociado a la auditoría');
            }
            
            const temas = await this.obtenerTemasInforme(informe._id);
            const temasReestructurados = await this.reestructurarTemas(temas);
            const [anio, mes, dia] = informe.fecha_emision.split('T')[0].split('-');
            const [tituloInforme, jefeOci, auditorResponsable, dependencias] = await Promise.all([
                this.generarTituloInforme(auditoria._id, auditoria.tipo_evaluacion_id, auditoria.titulo),
                this.tercerosService.getJefeOCI(),
                this.obtenerAuditorResponsable(auditoria._id),
                this.obtenergrupoDependencias(auditoria.dependencia_id)
            ]);

            const infoParaPlantilla = {
                plantilla_id: PLANTILLAS.INFORME_AUDITORIA_INTERNA,
                data: {
                    consecutivo: auditoria.consecutivo_no_auditoria,
                    fecha_emision: {
                        dia: dia,
                        mes: mes,
                        anio: anio,
                    },
                    informe: {
                        titulo: tituloInforme,
                        dependencias: dependencias,
                        procreso: auditoria.proceso,
                        objetivo: auditoria.objetivo,
                        alcance: auditoria.alcance,
                        criterios: auditoria.criterio,
                        muestra: informe.muestra,
                    },
                    aspectos_generales: this.normalizarTextoEditor(informe.aspecto_general),
                    temas: temasReestructurados,
                    informe_final: this.normalizarTextoEditor(informe.informe_final),
                    observaciones_conclusiones: this.normalizarTextoEditor(informe.observacion_conclusion),
                    notas: this.normalizarTextoEditor(informe.nota),
                    jefe_oci: jefeOci || "No se encontró el jefe de la Oficina Asesora de Control Interno",
                    auditor_responsable: auditorResponsable
                }
            }
            return infoParaPlantilla;
        } catch (error) {
            throw new HttpException(
                'Error al organizar los datos para la plantilla',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    private normalizarTextoEditor(valor: string | null | undefined): string {
        if (!valor) {
            return '';
        }

        return valor
            .replace(/&nbsp;/gi, ' ')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>\s*<p>/gi, '\n')
            .replace(/<[^>]*>/g, '')
            .replace(/\s+\n/g, '\n')
            .replace(/\n\s+/g, '\n')
            .trim();
    }

    private async obtenerInformeAuditoria(idAuditoria: string) {
        const params = {
            query: `auditoria_id:${idAuditoria},activo:true`,
            limit: 1
        };
        const respuestaInforme = await this.auditoriaCrudService.traerDataCrud('informe', null, params);
        return respuestaInforme.Data[0];
    }


    private async obtenerTemasInforme(idInforme: string) {
        const params = {
            query: `informe_id:${idInforme},activo:true`,
            limit: 0
        };
        const respuestaTemas = await this.auditoriaCrudService.traerDataCrud('tema', null, params);
        return respuestaTemas.Data;
    }

    private async generarTituloInforme(idAuditoria: string, tipo_evaluacion_id: number, auditoriaTitulo: string) {
        const tipo =
            tipo_evaluacion_id === TIPO_EVALUACION.AUDITORIA_INTERNA
                ? "Auditoria Interna"
                : "Auditoria de Seguimiento";

        const params = {
            query: `auditoria_id:${idAuditoria},activo:true,actual:true`,
            limit: 1,
        }
        const estado_id = await this.auditoriaCrudService.traerDataCrud('auditoria-estado', null, params).then(data => data.Data);

        const sufijo = ESTADOS_INFORME_AUDITORIA_PRELIMINAR.includes(estado_id)
            ? "Preliminar"
            : "Final";

        return `${tipo}: ${auditoriaTitulo} - ${sufijo}`;
    }

    private async reestructurarTemas(temas: any[]) {
        return temas.map(({ subtema, ...data }) => ({
            ...data,
            subtemas: subtema?.map(({ hallazgo, ...sub }) => ({
                ...sub,
                hallazgos: hallazgo ?? [],
            })) ?? [],
        }));
    }

    private async obtenerAuditorResponsable(auditoriaId: string): Promise<string> {
        const params = { query: `auditoria_id:${auditoriaId},activo:true`, limit: 0 }
        const auditores = await this.auditoriaCrudService.traerDataCrud('auditor', null, params).then(data => data.Data);
        switch (auditores.length) {
            case 0:
                return 'Sin auditor asignado.';
            case 1:
                const tercero = await this.tercerosService.getTerceroById(auditores[0].auditor_id);
                return tercero?.NombreCompleto || 'Sin auditor asignado.';
            default:
                const auditorLider = auditores.find(a => a.auditor_lider == true);
                if (auditorLider) {
                    const tercero = await this.tercerosService.getTerceroById(auditorLider.auditor_id);
                    return tercero?.NombreCompleto || 'Sin auditor asignado.';
                } else {
                    const tercero = await this.tercerosService.getTerceroById(auditores[0].auditor_id);
                    return tercero?.NombreCompleto || 'Sin auditor asignado.';
                }
        }
    }

    private async obtenergrupoDependencias(dependencias: any): Promise<any> {
    const respuestaDependencias = [];

    try {
      if (Array.isArray(dependencias)) {
        for (const idDependencia of dependencias) {
          const dependencia = await this.oikosService.traerData('dependencia', idDependencia, null).then(data => data.Data);
          const liderDependencia = await this.tercerosService.getTerceroVinculado(idDependencia, CARGO.JEFE_DEPENDENCIA_ID);
          const responsableDependencia = await this.tercerosService.getTerceroVinculado(idDependencia, CARGO.ASISTENTE_DEPENDENCIA_ID);  

          respuestaDependencias.push({
            nombre: dependencia.Nombre,
            lider: liderDependencia?.NombreCompleto || 'No se encontró el líder de la dependencia',
            responsable: responsableDependencia?.NombreCompleto || 'No se encontró el responsable de la dependencia'
          });
        }
      } else {
        const dependencia = await this.oikosService.traerData('dependencia', dependencias, null).then(data => data.Data);
        const liderDependencia = await this.tercerosService.getTerceroVinculado(dependencias, CARGO.JEFE_DEPENDENCIA_ID);
        const responsableDependencia = await this.tercerosService.getTerceroVinculado(dependencias, CARGO.ASISTENTE_DEPENDENCIA_ID);

        respuestaDependencias.push({
          nombre: dependencia.Nombre,
          lider: liderDependencia?.NombreCompleto || 'No se encontró el líder de la dependencia',
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
