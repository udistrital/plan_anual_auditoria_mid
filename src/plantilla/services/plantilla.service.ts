import { Injectable, HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { environment } from 'src/config/configuration';
import { lastValueFrom } from 'rxjs';
import { jsonPlantillaDto, PlantillaDto } from '../dto/plantilla.dto';

const {
  PLAN_AUDITORIA_CRUD_SERVICE,
  PLANTILLAS,
  MESES,
  PLANTILLAS_MID_SERVICE,
} = environment;

@Injectable()
export class PlantillaService {
  constructor(private readonly httpService: HttpService) {}
  async getOne(id: string, conEspeciales: boolean) {
    let data = await this.traerDataCrud(id);
    if (conEspeciales)
      data = await this.anadirDataEspeciales(data);

    const baseJson = await this.organizarData(data);
    const baseRenderizado = await this.renderizar(baseJson);
    return baseRenderizado;
  }

  private async traerDataCrud(id: string) {
    let urlPlanAuditoria = `${PLAN_AUDITORIA_CRUD_SERVICE}plan-auditoria/${id}`;
    let urlAuditioria = `${PLAN_AUDITORIA_CRUD_SERVICE}auditoria?query=plan_auditoria_id:${id},activo:true&fields=titulo,cronograma_id&limit=0`;
    try {
      const responsePlanAuditoria = await lastValueFrom(
        this.httpService.get(urlPlanAuditoria),
      );
      let dataPlanAuditoria = responsePlanAuditoria.data;
      const responseAuditoria = await lastValueFrom(
        this.httpService.get(urlAuditioria),
      );
      let dataAuditoria = responseAuditoria.data;

      return { dataPlanAuditoria, dataAuditoria };
    } catch (error) {
      throw new HttpException(
        'Error al obtener los datos del servicio externo ',
        error,
      );
    }
  }

  /**
   * Recover special audit program (same vigencia bur no PAA) data and add it to the main data object.
   * @param data The main data object containing the audit plan and audits.
   * @returns The updated data object with the special audit data included.
   */
  private async anadirDataEspeciales(data: any) {
    const vigenciaId = data.dataPlanAuditoria.Data?.vigencia_id;
    const urlAuditioria = `${PLAN_AUDITORIA_CRUD_SERVICE}auditoria?query=vigencia_id:${vigenciaId},plan_anual_auditoria_id__is_null:true,activo:true&fields=titulo,cronograma_id&limit=0`;

    try {
      const responseAuditoriaEspecial = await lastValueFrom(
        this.httpService.get(urlAuditioria),
      );
      let dataAuditoriaEspecial = responseAuditoriaEspecial.data;

      return { ...data, dataAuditoriaEspecial };
    } catch (error) {
      throw new HttpException(
        'Error al obtener los datos de auditoría especial del servicio externo ',
        error,
      );
    }
  }

  private async organizarData(data: any) {
    const json = new jsonPlantillaDto();

    const auditorias = data.dataAuditoria?.Data || [];
    const auditoriasOrden = data.dataPlanAuditoria?.Data?.auditorias || [];
    const auditoriasOrdenadas = this.ordenarAuditorias(
      auditorias,
      auditoriasOrden,
    );

    const items: PlantillaDto[] = Array.isArray(auditorias)
      ? auditoriasOrdenadas.map((auditoria: any) =>
          this.organizarItems(auditoria),
        )
      : [];

    const auditoriasEspeciales = data.dataAuditoriaEspecial?.Data || [];
    const auditoriasEspecialesOrden = data.dataPlanAuditoria?.Data?.auditorias_especiales || [];
    const auditoriasEspecialesOrdenadas = this.ordenarAuditorias(
      auditoriasEspeciales,
      auditoriasEspecialesOrden,
    );

    const especiales: PlantillaDto[] = Array.isArray(auditoriasEspeciales)
      ? auditoriasEspecialesOrdenadas.map((auditoria: any) =>
          this.organizarItems(auditoria),
        )
      : [];

    json.plantilla_id = PLANTILLAS.PLAN_ANUAL_AUDITORIA;
    json.data = {
      codigo: 'EC-PR-005-FR-001',
      proceso: 'Gestión de la Evaluación y el Control',
      objetivo: data.dataPlanAuditoria.Data?.objetivo || '',
      alcance: data.dataPlanAuditoria.Data?.alcance || '',
      criterios: data.dataPlanAuditoria.Data?.criterio || '',
      recursos: data.dataPlanAuditoria.Data?.recurso || '',
      items: items,
      especiales: especiales,
    };

    return json;
  }
  private organizarItems(data: any): PlantillaDto {
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

    return {
      actividad: data.titulo || '',
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

  private async renderizar(data: jsonPlantillaDto) {
    let urlPlanAuditoria = `${PLANTILLAS_MID_SERVICE}/v1/plantilla/renderizar`;
    try {
      const response = await lastValueFrom(
        this.httpService.post(urlPlanAuditoria, data),
      );
      return response.data;
    } catch (error) {
      console.error('Error al enviar data:', error);
      throw new Error('No se pudo enviar el plan');
    }
  }
}
