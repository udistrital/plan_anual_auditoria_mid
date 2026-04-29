import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { TercerosHelperService } from 'src/shared/services/terceros-helper.service';

@Injectable()
export class AuditadoService {
  constructor(
    private readonly auditoriaCrudService: AuditoriaCrudService,
    private readonly tercerosHelper: TercerosHelperService,
  ) {}

  async filtrarDocumentosPorDependencia(
    personaId: number,
    auditoriaId: string,
    cargoId: number,
    tipoDocumentoId?: string,
  ) {
    try {
      // 1. Construir filtros
      const queryParams = {
        query: `referencia_id:${auditoriaId},activo:true`,
        limit: 0,
      };

      // 2. Tipos de documento
      const tiposDocumentosArray = tipoDocumentoId
        ? tipoDocumentoId.split(',').map((id) => parseInt(id, 10))
        : [];

      // 3. Obtener dependencias desde helper
      const dependenciasAuditado =
        await this.tercerosHelper.getDependenciasByPersona(
          personaId,
          cargoId,
        );

      console.log('dependenciasAuditado:', dependenciasAuditado);

      // 4. Obtener documentos desde CRUD service
      const response = await this.auditoriaCrudService.traerDataCrud(
        'documento',
        null,
        queryParams,
      );

      const documentos = response?.Data || [];

      console.log('documentos obtenidos:', documentos.length);

      // 5. Filtrar documentos
      const documentosFiltrados = documentos.filter((documento: any) => {
        const tipoDocumentoOk =
          tiposDocumentosArray.length === 0 ||
          tiposDocumentosArray.includes(documento.tipo_id);

        const dependenciaOk =
          !documento.metadatos ||
          dependenciasAuditado.includes(
            documento.metadatos?.dependencia_id,
          );

        const firmaOk =
          documento.metadatos?.firmado === true ||
          documento.metadatos?.firmado === false;

        return (tipoDocumentoOk && dependenciaOk) || firmaOk;
      });

      console.log('documentos filtrados:', documentosFiltrados.length);

      return documentosFiltrados;
    } catch (error) {
      console.error('Error en filtrarDocumentosPorDependencia:', error);

      throw new HttpException(
        'Error al filtrar documentos',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}