import { Injectable } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';
import { environment } from 'src/config/configuration';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { TercerosHelperService } from 'src/shared/services/terceros-helper.service';
import { DominiosService } from 'src/shared/utils/dominios/dominios.service';

@Injectable()
export class ResponsableAccionService {
  constructor(
    private readonly auditoriaCrudService: AuditoriaCrudService,
    private readonly dominiosService: DominiosService,
    private readonly tercerosHelper: TercerosHelperService,
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
      const dep_id = elemento?.dependencia_id ?? null
      if (dep_id) {
        elemento.dependencia_nombre = dependenciasMap.get(dep_id) ?? null;
        const [jefe_dep, asistente_dep] = await Promise.all([
          this.tercerosHelper.getTerceroVinculado(
            dep_id,
            environment.CARGO.JEFE_DEPENDENCIA_ID,
          ),
          this.tercerosHelper.getTerceroVinculado(
            dep_id,
            environment.CARGO.ASISTENTE_DEPENDENCIA_ID,
          ),
        ]);
        elemento.jefe_nombre = jefe_dep?.NombreCompleto;
        elemento.asistente_nombre = asistente_dep?.NombreCompleto;
      }
    }

    return data;
  }
}
