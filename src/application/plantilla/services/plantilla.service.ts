import { Injectable } from '@nestjs/common';
import { environment } from 'src/config/configuration';
import { lastValueFrom } from 'rxjs';
import { JsonPlantillaDto, PlantillaDto } from '../dto/plantilla.dto';
import { DominiosService } from 'src/shared/utils/dominios/dominios.service';
import { Dominio } from 'src/shared/utils/dominios/dominio.model';
import { PlantillasMidService } from 'src/shared/services/plantillas-mid.service';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';

const { PLANTILLAS, MESES } = environment;

@Injectable()
export class PlantillaService {
  constructor(
    private readonly dominiosService: DominiosService,
    private readonly plantillasMidService: PlantillasMidService,
    private readonly auditoriaCrudService: AuditoriaCrudService,
  ) {}
  async getOne(id: string, conEspeciales: boolean, auditoriaPadre: boolean) {
    let data = await this.traerDataCrud(id, auditoriaPadre);
    if (conEspeciales)
      data = await this.anadirDataEspeciales(data, auditoriaPadre);

    const baseJson = await this.organizarData(data);
    const baseRenderizado = await this.plantillasMidService.post(
      '/v1/plantilla/renderizar',
      baseJson,
    );
    return baseRenderizado;
  }

  private async traerDataCrud(id: string, auditoriaPadre: boolean) {
    const dataPlanAuditoria = await this.auditoriaCrudService.traerDataCrud(
      'plan-auditoria',
      id,
      null,
    );

    const endpointAuditoria = auditoriaPadre ? 'auditoria-padre' : 'auditoria';
    const params = {
      query: `plan_auditoria_id:${id},activo:true`,
      fields:
        'titulo,macroproceso_id,proceso_id,dependencia_id,cronograma_id,cantidad_auditorias',
      limit: 0,
    };
    const dataAuditoria = await this.auditoriaCrudService.traerDataCrud(
      endpointAuditoria,
      null,
      params,
    );
    return { dataPlanAuditoria, dataAuditoria };
  }

  /**
   * Recover special audit program (same vigencia bur no PAA) data and add it to the main data object.
   * @param data The main data object containing the audit plan and audits.
   * @param auditoriaPadre A boolean indicating whether to use the parent audit or the original collection of audits.
   * @returns The updated data object with the special audit data included.
   */
  private async anadirDataEspeciales(data: any, auditoriaPadre: boolean) {
    const vigenciaId = data.dataPlanAuditoria.Data?.vigencia_id;
    const endpointAuditoria = auditoriaPadre ? 'auditoria-padre' : 'auditoria';

    const params = {
      query: `vigencia_id:${vigenciaId},plan_auditoria_id__isnull:true,activo:true`,
      fields:
        'titulo,macroproceso_id,proceso_id,dependencia_id,cronograma_id,cantidad_auditorias',
      limit: 0,
    };
    const dataAuditoriaEspecial = await this.auditoriaCrudService.traerDataCrud(
      endpointAuditoria,
      null,
      params,
    );

    return { ...data, dataAuditoriaEspecial };
  }

  private async organizarData(data: any) {
    const json = new JsonPlantillaDto();

    const auditorias = data.dataAuditoria?.Data || [];
    const auditoriasOrden = data.dataPlanAuditoria?.Data?.auditorias || [];
    const auditoriasOrdenadas = this.ordenarAuditorias(
      auditorias,
      auditoriasOrden,
    );

    const dominios: { [key: string]: Dominio } = {};
    dominios.macroproceso = await lastValueFrom(
      this.dominiosService.getParametros(
        environment.TIPO_PARAMETRO.MACROPROCESO,
      ),
    );
    dominios.proceso = await lastValueFrom(
      this.dominiosService.getParametros(environment.TIPO_PARAMETRO.PROCESO),
    );
    dominios.dependencia = await lastValueFrom(
      this.dominiosService.getDependencias(),
    );

    const items: Promise<PlantillaDto[]> = Array.isArray(auditorias)
      ? Promise.all(
          auditoriasOrdenadas.map((auditoria: any) =>
            this.organizarItems(auditoria, dominios),
          ),
        )
      : Promise.resolve([]);

    const auditoriasEspeciales = data.dataAuditoriaEspecial?.Data || [];
    const auditoriasEspecialesOrden =
      data.dataPlanAuditoria?.Data?.auditorias_especiales || [];
    const auditoriasEspecialesOrdenadas = this.ordenarAuditorias(
      auditoriasEspeciales,
      auditoriasEspecialesOrden,
    );

    const especiales: Promise<PlantillaDto[]> = Array.isArray(
      auditoriasEspeciales,
    )
      ? Promise.all(
          auditoriasEspecialesOrdenadas.map((auditoria: any) =>
            this.organizarItems(auditoria, dominios),
          ),
        )
      : Promise.resolve([]);

    json.plantilla_id = PLANTILLAS.PLAN_ANUAL_AUDITORIA;
    json.data = {
      codigo: 'EC-PR-005-FR-001',
      proceso: 'Gestión de la Evaluación y el Control',
      objetivo: data.dataPlanAuditoria.Data?.objetivo || '',
      alcance: data.dataPlanAuditoria.Data?.alcance || '',
      criterios: data.dataPlanAuditoria.Data?.criterio || '',
      recursos: data.dataPlanAuditoria.Data?.recurso || '',
      items: await items,
      especiales: await especiales,
    };

    return json;
  }

  private async organizarItems(
    data: any,
    dominios: { [key: string]: Dominio },
  ): Promise<PlantillaDto> {
    const idMesMap = {
      [MESES.ENERO]: 'enero',
      [MESES.FEBRERO]: 'febrero',
      [MESES.MARZO]: 'marzo',
      [MESES.ABRIL]: 'abril',
      [MESES.MAYO]: 'mayo',
      [MESES.JUNIO]: 'junio',
      [MESES.JULIO]: 'julio',
      [MESES.AGOSTO]: 'agosto',
      [MESES.SEPTIEMBRE]: 'septiembre',
      [MESES.OCTUBRE]: 'octubre',
      [MESES.NOVIEMBRE]: 'noviembre',
      [MESES.DICIEMBRE]: 'diciembre',
    };

    const mesesMarcados = Object.keys(idMesMap).reduce(
      (acc, id) => {
        acc[idMesMap[id]] = '';
        return acc;
      },
      {} as { [key: string]: string },
    );

    (data.cronograma_id || []).forEach((id: number) => {
      const mes = idMesMap[id];
      if (mes) {
        mesesMarcados[mes] = 'marcado';
      } else {
        mesesMarcados[mes] = '';
      }
    });

    const macroproceso = this.resolverNombres(
      data.macroproceso_id,
      dominios.macroproceso,
    );
    const proceso = this.resolverNombres(data.proceso_id, dominios.proceso);
    const dependencia = this.resolverNombres(
      data.dependencia_id,
      dominios.dependencia,
    );

    return {
      actividad: data.titulo || 'No definido',
      macroproceso: macroproceso,
      proceso: proceso,
      dependencia: dependencia,
      cantidad_auditorias: parseInt(data?.cantidad_auditorias, 10),
      ...mesesMarcados,
    };
  }

  private ordenarAuditorias(auditorias: any[], auditoriasOrden: string[]) {
    const auditoriasMap = new Map(
      auditorias.map((auditoria) => [auditoria._id, auditoria]),
    );

    // Ordenar las auditorías según el orden de los IDs en auditoriasOrden
    const auditoriasOrdenadas = auditoriasOrden
      .map((id) => auditoriasMap.get(id))
      .filter((auditoria) => auditoria !== undefined);

    // Agregar al final las auditorías activas no incluidas en auditoriasOrden
    const restantes = auditorias.filter(
      (auditoria) => !auditoriasOrden.includes(auditoria._id),
    );

    return [...auditoriasOrdenadas, ...restantes];
  }

  private resolverNombres(
    id: number | number[] | null,
    dominio: Dominio,
  ): string {
    if (id == null) return 'No definido';
    const ids = Array.isArray(id) ? id : [id];
    return ids.map((i) => this.getParametroName(i, dominio)).join(', ');
  }

  /**
   * Obtains the name of a parameter given its ID by searching through the provided Dominio object.
   * @param parametroId The ID of the parameter to find.
   * @param dominio The Dominio object containing the list of parameters to search through.
   * @returns The name of the parameter corresponding to the provided ID if found.
   * @returns "?error" if the parameter with the given ID is not found in the Dominio.
   * @throws An error if there is an issue during the search process.
   */
  private getParametroName(
    parametroId: number | number[],
    dominio: Dominio,
  ): string {
    const parametros = dominio.parametros;

    if (Array.isArray(parametroId)) {
      return parametroId
        .map((id) => {
          const parametro = parametros.find((p) => p.Id === id);
          return parametro ? parametro.Nombre : String(id);
        })
        .join(', ');
    }

    const parametro = parametros.find((p) => p.Id === parametroId);
    if (!parametro) {
      throw new Error(
        `Parametro with ID ${parametroId} not found in dominio ${dominio.nombre} para plantillas`,
      );
    }

    return parametro.Nombre;
  }
}
