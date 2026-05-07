import { Inject, Injectable } from '@nestjs/common';
import { environment } from 'src/config/configuration';
import { capitalize, unirListaNombres } from 'src/utils/texto.utils';
import { AuditoriaService } from 'src/application/auditoria/auditoria.service';
import { PlantillasMidService } from 'src/shared/services/plantillas-mid.service';
import { ParametrosService } from 'src/shared/services/parametros.service';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { TercerosHelperService } from 'src/shared/services/terceros-helper.service';
import { OikosService } from 'src/shared/services/oikos.service';

const { PLANTILLAS, logoUDistrital, logoSIGUD, CARGO } = environment;

@Injectable()
export class PlantillaProgramaAuditoriaService {
  constructor(
    private readonly auditoriaService: AuditoriaService,
    private readonly auditoriaCrudService: AuditoriaCrudService,
    private readonly plantillasMidService: PlantillasMidService,
    private readonly parametrosService: ParametrosService,
    private readonly tercerosService: TercerosHelperService,
    private readonly oikosService: OikosService,
    @Inject('MOMENT') private readonly moment: any,
  ) {}

  async get(idAuditoria: string) {
    const auditoria = await this.auditoriaService.getOne(idAuditoria);
    const infoParaPlantilla = await this.organizarData(auditoria.Data);
    const baseRenderizado = await this.plantillasMidService.post(
      '/v1/plantilla/renderizar',
      infoParaPlantilla,
    );
    return baseRenderizado;
  }

  private async organizarData(auditoria: any) {
    try {
      const auditoriaPadre = auditoria;
      const dependenciaPrincipal = this.obtenerDependenciaPrincipal(
        auditoriaPadre?.dependencia_id,
      );

      const [
        actividades,
        macroproceso,
        proceso,
        dependencia,
        Lider,
        Responsable,
        grupoAuditor,
      ] = await Promise.all([
        this.auditoriaCrudService
          .traerDataCrud('actividad', null, {
            query: `auditoria_id:${auditoria._id},activo:true`,
            limit: 0,
          })
          .then((data) => data.Data),
        this.parametrosService
          .get('parametro', auditoriaPadre.macroproceso_id, null)
          .then((data) => data.Data),
        this.parametrosService
          .get('parametro', auditoriaPadre.proceso_id, null)
          .then((data) => data.Data),
        this.oikosService
          .traerData('dependencia', dependenciaPrincipal, null),
        this.tercerosService.getTerceroVinculado(
          dependenciaPrincipal,
          CARGO.JEFE_DEPENDENCIA_ID,
        ),
        this.tercerosService.getTerceroVinculado(
          dependenciaPrincipal,
          CARGO.ASISTENTE_DEPENDENCIA_ID,
        ),
        this.obtenerNombresAuditores(auditoria._id),
      ]);

      const actividadesOrganizadas = this.organizarActividades(
        actividades,
        grupoAuditor,
      );
      const infoParaPlantilla = {
        plantilla_id: PLANTILLAS.PROGRAMA_TRABAJO,
        data: {
          actividades: actividadesOrganizadas,
          recursosTecnologicos: auditoria.rec_tecnologico,
          recursosMateriales: auditoria.rec_fisico,
          macroproceso: macroproceso.Nombre,
          proceso: proceso.Nombre,
          dependencia: dependencia.Nombre,
          lider: Lider?.NombreCompleto || '',
          responsable: Responsable?.NombreCompleto || '',
          objetivos: auditoria.objetivo,
          alcance: auditoria.alcance,
          criterios: auditoria.criterio,
          equipoAuditor: grupoAuditor,
          periodoEjecucion:
            this.moment(auditoria.fecha_inicio).format('DD/MM/YYYY') +
            ' - ' +
            this.moment(auditoria.fecha_fin).format('DD/MM/YYYY'),
          logoUDistrital: logoUDistrital,
          logoSIGUD: logoSIGUD,
        },
      };

      return infoParaPlantilla;
    } catch (error: any) {
      const newError = new Error(
        'Error al organizar los datos para la plantilla del programa',
      );
      newError.stack = error.stack;
      throw newError;
    }
  }

  private organizarActividades(actividades: any[], grupoAuditor: string) {
    return actividades.map((dataActividad) => ({
      actividad: dataActividad.titulo,
      auditor: grupoAuditor,
      fechaInicial: this.moment(dataActividad.fecha_inicio).format('DD/MM/YYYY'),
      fechaFinal: this.moment(dataActividad.fecha_fin).format('DD/MM/YYYY'),
      observacion: dataActividad.observacion || '',
      referencia: dataActividad.referencia || '',
      descripcion: dataActividad.descripcion || '',
      folio: dataActividad.folio || '',
      medio: dataActividad.medio || '',
      carpeta: dataActividad.carpeta || '',
    }));
  }

  private async obtenerNombresAuditores(auditoriaId: string): Promise<string> {
    const params = {
      query: `auditoria_id:${auditoriaId},activo:true`,
      fields: 'auditor_id',
      limit: '0',
    };
    const auditores = await this.auditoriaCrudService
      .traerDataCrud('auditor', null, params)
      .then((data) => data.Data);

    if (!auditores?.length) return 'No se encontraron auditores.';

    const nombres = await Promise.all(
      auditores.map(async (auditor) => {
        const tercero = await this.tercerosService.getTerceroById(
          auditor.auditor_id,
        );
        return tercero?.NombreCompleto
          ? capitalize(tercero.NombreCompleto)
          : null;
      }),
    );

    const todosValidos = nombres.every((nombre) => nombre !== null);

    if (!todosValidos) {
      throw new Error('Error al obtener los nombres de los auditores para plantilla Programa de Auditoría');
    }

    return unirListaNombres(nombres);
  }

  private obtenerDependenciaPrincipal(
    dependenciaId: number | number[],
  ): number | null {
    if (Array.isArray(dependenciaId)) {
      return dependenciaId.length > 0 ? dependenciaId[0] : null;
    }

    return typeof dependenciaId === 'number' ? dependenciaId : null;
  }
}
