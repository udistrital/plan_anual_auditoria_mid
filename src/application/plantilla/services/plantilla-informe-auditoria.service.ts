import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';
import { AuditoriaService } from 'src/application/auditoria/auditoria.service';
import { environment as env } from 'src/config/configuration';
import { PlantillaUtilsService } from 'src/utils/plantilla.utils';

@Injectable()
export class PlantillaInformeAuditoriaService {
    constructor(
        private readonly httpService: HttpService,
        private readonly plantillaUtils: PlantillaUtilsService,
        private readonly auditoriaService: AuditoriaService,
    ) { }

    async get(idAuditoria: string) {
        const auditoriaRespuesta = await this.auditoriaService.getOne(idAuditoria);
        const infoParaPlantilla = await this.organizarData({ auditoria: auditoriaRespuesta?.Data || {} });
        return await this.plantillaUtils.renderizarPlantilla(infoParaPlantilla);
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
            
            const auditoriaPadreRespuesta = await this.auditoriaService.getAll({query: `_id:${auditoria.auditoria_padre_id}`});
            const auditoriaPadre = auditoriaPadreRespuesta.Data[0];
            const temas = await this.obtenerTemasInforme(informe._id);
            const temasReestructurados = await this.reestructurarTemas(temas);
            const [anio, mes, dia] = informe.fecha_emision.split('T')[0].split('-');
            const [tituloInforme, jefeOci, auditorResponsable, dependencias] = await Promise.all([
                this.generarTituloInforme(auditoria._id, auditoria.tipo_evaluacion_id, auditoria.titulo),
                this.obtenerJefeOci(),
                this.obtenerAuditorResponsable(auditoria._id),
                this.obtenergrupoDependencias(auditoriaPadre.dependencia_id)
            ]);

            const infoParaPlantilla = {
                plantilla_id: env().PLANTILLAS.INFORME_AUDITORIA_INTERNA,
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
        const urlInforme = `${env().PLAN_AUDITORIA_CRUD_SERVICE}informe?query=auditoria_id:${idAuditoria},activo:true&fields=_id,fecha_emision,muestra,aspecto_general,informe_final,observacion_conclusion,nota&limit=1`;
        try {
            const respuestaInforme = await lastValueFrom(this.httpService.get(urlInforme));
            return respuestaInforme.data.Data[0];
        } catch (error) {
            throw new HttpException(
                'Error al obtener los datos del servicio externo ',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }


    private async obtenerTemasInforme(idInforme: string) {
        const urlTemas = `${env().PLAN_AUDITORIA_CRUD_SERVICE}tema?query=informe_id:${idInforme},activo:true`;
        try {
            const respuestaTemas = await lastValueFrom(
                this.httpService.get(urlTemas),
            );
            return respuestaTemas.data.Data || [];
        } catch (error) {
            throw new HttpException(
                'Error al obtener los datos del servicio externo ',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    private async generarTituloInforme(idAuditoria: string, tipo_evaluacion_id: number, auditoriaTitulo: string) {
        const tipo =
            tipo_evaluacion_id === env().TIPO_EVALUACION.AUDITORIA_INTERNA
                ? "Auditoria Interna"
                : "Auditoria de Seguimiento";

        const estado_id = await this.consultarEstadoAuditoria(idAuditoria);

        const sufijo = env().ESTADOS_INFORME_AUDITORIA_PRELIMINAR.includes(estado_id)
            ? "Preliminar"
            : "Final";

        return `${tipo}: ${auditoriaTitulo} - ${sufijo}`;
    }

    private async consultarEstadoAuditoria(idAuditoria: string) {
        const urlEstadoAuditoria = `${env().PLAN_AUDITORIA_CRUD_SERVICE}auditoria-estado?query=auditoria_id:${idAuditoria},activo:true,actual:true&fields=estado_id&limit=1`;

        try {
            const respuestaEstado = await lastValueFrom(this.httpService.get(urlEstadoAuditoria));
            return respuestaEstado.data.Data[0].estado_id;
        } catch (error) {
            throw new HttpException(
                'Error al obtener el estado de la auditoria',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
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

    // private async traerParametros(idParam: string) {
    //     const url = `${PARAMETROS_SERVICE}/parametro?query=Id:${idParam}&fields=Nombre`;
    //     try {
    //         const response = await lastValueFrom(this.httpService.get(url));
    //         return response.data.Data[0];
    //     } catch (error) {
    //         throw new HttpException(
    //             'Error al obtener los datos del servicio externo',
    //             HttpStatus.INTERNAL_SERVER_ERROR,
    //         );
    //     }
    // }

    private async obtenerAuditorResponsable(auditorId: string): Promise<string> {
        const auditores = (await this.obtenerAuditores(auditorId)) || [];
        switch (auditores.length) {
            case 0:
                return 'Sin auditor asignado.';
            case 1:
                const tercero = await this.obtenerTercero(auditores[0].auditor_id);
                return tercero?.NombreCompleto || 'Sin auditor asignado.';
            default:
                const auditorLider = auditores.find(a => a.auditor_lider == true);
                if (auditorLider) {
                    const tercero = await this.obtenerTercero(auditorLider.auditor_id);
                    return tercero?.NombreCompleto || 'Sin auditor asignado.';
                } else {
                    const tercero = await this.obtenerTercero(auditores[0].auditor_id);
                    return tercero?.NombreCompleto || 'Sin auditor asignado.';
                }
        }
    }

    private async obtenerAuditores(auditoriaId: string) {
        const url = `${env().PLAN_AUDITORIA_CRUD_SERVICE}auditor?query=auditoria_id:${auditoriaId},activo:true&limit=0`;
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

    private async obtenerTercero(terceroId: string) {
        const url = `${env().TERCEROS_SERVICE}/tercero/${terceroId}`;
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


    private async obtenerJefeOci() {
        const url = `${env().TERCEROS_SERVICE}vinculacion?query=DependenciaId:${env().ID_DEPENDENCIA_OCI},CargoId:${env().CARGO.JEFE_DEPENDENCIA_ID},Activo:true`;
        try {
            const response = await lastValueFrom(this.httpService.get(url));
            return response.data?.[0]?.TerceroPrincipalId?.NombreCompleto || "No se encontró el jefe de la Oficina Asesora de Control Interno";
        } catch (error) {
            return "No se encontró el jefe de la Oficina Asesora de Control Interno";
        }
    }

    private async obtenergrupoDependencias(dependencias: any): Promise<any> {
    const respuestaDependencias = [];

    try {
      if (Array.isArray(dependencias)) {
        for (const idDependencia of dependencias) {
          const dependencia = await this.obtenerDependencia(idDependencia);
          const liderDependencia = await this.obtenerTerceroVinculado(env().CARGO.JEFE_DEPENDENCIA_ID, idDependencia);
          const responsableDependencia = await this.obtenerTerceroVinculado(env().CARGO.ASISTENTE_DEPENDENCIA_ID, idDependencia);  

          respuestaDependencias.push({
            nombre: dependencia.Nombre,
            lider: liderDependencia?.NombreCompleto || 'No se encontró el líder de la dependencia',
            responsable: responsableDependencia?.NombreCompleto || 'No se encontró el responsable de la dependencia'
          });
        }
      } else {
        const dependencia = await this.obtenerDependencia(dependencias);
        const liderDependencia = await this.obtenerTerceroVinculado(env().CARGO.JEFE_DEPENDENCIA_ID, dependencias);
        const responsableDependencia = await this.obtenerTerceroVinculado(env().CARGO.ASISTENTE_DEPENDENCIA_ID, dependencias);

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

  private async obtenerDependencia(idDependencia: string) {
    const url = `${env().OIKOS_SERVICE}dependencia/${idDependencia}`;
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
}
