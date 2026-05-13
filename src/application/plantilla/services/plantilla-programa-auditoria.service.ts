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

      const [
        actividades,
        macroprocesos,
        procesos,
        dependencias,
        lideres,
        responsables,
        grupoAuditor,
      ] = await Promise.all([
        // actividades
        this.auditoriaCrudService
          .traerDataCrud('actividad', null, {
            query: `auditoria_id:${auditoria._id},activo:true`,
            limit: 0,
          })
          .then((data) => data.Data),
        // macroprocesos
        Promise.all(
          auditoriaPadre.macroproceso_id.map((macroproceso_id: number) =>
            this.parametrosService
              .get('parametro', macroproceso_id, null)
              .then((data) => data.Data),
          ),
        ),
        // procesos
        Promise.all(
          auditoriaPadre.proceso_id.map((proceso_id: number) =>
            this.parametrosService
              .get('parametro', proceso_id, null)
              .then((data) => data.Data),
          ),
        ),
        // dependencias
        Promise.all(
          auditoriaPadre.dependencia_id.map((dependencia_id: number) =>
            this.oikosService.traerData('dependencia', dependencia_id, null),
          ),
        ),
        // lideres
        Promise.all(
          auditoriaPadre.dependencia_id.map((dependencia_id: number) =>
            this.tercerosService.getTerceroVinculado(
              dependencia_id,
              CARGO.JEFE_DEPENDENCIA_ID,
            ),
          ),
        ),
        // responsables
        Promise.all(
          auditoriaPadre.dependencia_id.map((dependencia_id: number) =>
            this.tercerosService.getTerceroVinculado(
              dependencia_id,
              CARGO.ASISTENTE_DEPENDENCIA_ID,
            ),
          ),
        ),
        // grupo auditor
        this.obtenerNombresAuditores(auditoria._id),
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
          macroproceso: macroprocesos
              .filter((mp: any) => mp)
              .map((mp: any) => mp.Nombre)
              .join(', '),
          proceso: procesos
              .filter((p: any) => p)
              .map((p: any) => p.Nombre)
              .join(', '),
          dependencia: dependencias
              .filter((d: any) => d)
              .map((d: any) => d.Nombre)
              .join(', '),
          lider: lideres
              .filter((l: any) => l)
              .map((l: any) => l.NombreCompleto)
              .join(', ') ?? '',
          responsable: responsables
              .filter((r: any) => r)
              .map((r: any) => r.NombreCompleto)
              .join(', ') ?? '',
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

}
