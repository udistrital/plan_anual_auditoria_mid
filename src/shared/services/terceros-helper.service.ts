import { Injectable } from '@nestjs/common';
import { TercerosService } from './terceros.service';
import { environment } from 'src/config/configuration';

const { CARGO, ID_DEPENDENCIA_OCI } = environment;

@Injectable()
export class TercerosHelperService {
  constructor(private readonly tercerosService: TercerosService) {}

  async getTerceroById(terceroId: string) {
    if (!terceroId) {
      console.warn('[TercerosHelper] terceroId vacío');
      return null;
    }
  
    try {
  
      const response = await this.tercerosService.traerData(
        'tercero',
        terceroId,
        null,
      );
  
      let tercero = null;
  
      if (Array.isArray(response)) {
        tercero = response[0];
      } else if (response?.Data && Array.isArray(response.Data)) {
        tercero = response.Data[0];
      } else if (response?.Data) {
        tercero = response.Data;
      } else {
        tercero = response;
      }
  
      return tercero;
  
    } catch (error) {
      console.error('[TercerosHelper] Error obteniendo tercero:', error);
      throw new Error('Error al obtener tercero');
    }
  }

  async getTerceroVinculado(
    dependenciaId: number,
    cargoId: number,
  ): Promise<any> {
  
    if (!dependenciaId || !cargoId) {
      return null;
    }
  
    const response = await this.tercerosService.traerData(
      'vinculacion',
      null,
      {
        query: `Activo:true,DependenciaId:${dependenciaId},CargoId:${cargoId}`,
        fields: 'TerceroPrincipalId',
        sortby: 'Id',
        order: 'desc',
      },
    );
  
    return response?.[0]?.TerceroPrincipalId || null;
  }

  async getDependenciasByPersona(personaId: number, cargoId: number): Promise<number[]> {
    if (!personaId || !cargoId) return [];

    try {
        const response = await this.tercerosService.traerData(
        'vinculacion',
        null,
        {
            query: `TerceroPrincipalId:${personaId},Activo:true,CargoId:${cargoId}`,
            fields: 'DependenciaId',
        },
        );

        const dependencias = (response || [])
        .map((v: any) => v.DependenciaId)
        .filter((id: any) => id != null);

        return dependencias;

    } catch (error: any) {
        console.error('[TercerosHelper] Error obteniendo dependencias:', {
        personaId,
        cargoId,
        error: error?.message || error,
        });

        return [];
    }
  }

  async getJefeOCI(): Promise<string> {
    try {
      const tercero = await this.getTerceroVinculado(
        ID_DEPENDENCIA_OCI,
        CARGO.JEFE_DEPENDENCIA_ID,
      );

      return tercero?.NombreCompleto || 'No se encontró el jefe OCI';
    } catch {
      return 'No se encontró el jefe OCI';
    }
  }

  async getAuditorResponsable(auditores: any[]): Promise<string> {
    if (!auditores || auditores.length === 0) {
      return 'Sin auditor asignado.';
    }

    let auditorSeleccionado = auditores[0];

    if (auditores.length > 1) {
      const lider = auditores.find(a => a.auditor_lider);
      if (lider) auditorSeleccionado = lider;
    }

    const tercero = await this.getTerceroById(
      auditorSeleccionado.auditor_id,
    );

    return tercero?.NombreCompleto || 'Sin auditor asignado.';
  }
}