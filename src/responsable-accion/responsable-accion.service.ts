import { Injectable } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud/auditoria-crud.service';
import { DominiosService } from 'src/shared/utils/dominios/dominios.service';

@Injectable()
export class ResponsableAccionService {
  constructor(
    private readonly auditoriaCrudService: AuditoriaCrudService,
    private readonly dominiosService: DominiosService,
  ) {}

  async getAll(queryParams: any) {
    const data = await this.auditoriaCrudService.traerDataCrud('responsable-accion', null, queryParams);
    await this.enriquecerDependencias(data);
    return data;
  }

  private async enriquecerDependencias(data: any) {
    if (!Array.isArray(data?.Data) || data.Data.length === 0) return data;

    const dominio = await lastValueFrom(this.dominiosService.getDependencias());
    const dependenciasMap = new Map<number, string>(
      dominio.parametros.map((dep: any) => [dep.Id, dep.Nombre]),
    );

    for (const elemento of data.Data) {
      if (elemento?.dependencia_id != null) {
        elemento.dependencia_nombre = dependenciasMap.get(elemento.dependencia_id) ?? null;
      }
    }

    return data;
  }
}
