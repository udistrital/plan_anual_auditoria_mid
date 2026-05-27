import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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
    // Validaciones de negocio
    if (!auditoriaId) {
      throw new BadRequestException('auditoria_id es requerido');
    }

    // 1. Construir filtros
    const queryParams = {
      query: `referencia_id:${auditoriaId},activo:true`,
      limit: 0,
    };

    // 2. Tipos de documento
    const tiposDocumentosArray = tipoDocumentoId
      ? tipoDocumentoId.split(',').map((id) => {
          const parsed = parseInt(id, 10);
          if (isNaN(parsed)) {
            throw new BadRequestException(
              `tipo_documento_id inválido: ${id}`,
            );
          }
          return parsed;
        })
      : [];

    // 3. Dependencias del auditado
    const dependenciasAuditado =
      await this.tercerosHelper.getDependenciasByPersona(
        personaId,
        cargoId,
      );

    // 4. Obtener documentos
    const response = await this.auditoriaCrudService.traerDataCrud(
      'documento',
      null,
      queryParams,
    );

    const documentos = response?.Data || [];

    if (!documentos.length) {
      throw new NotFoundException(
        'No se encontraron documentos para la auditoría',
      );
    }

    // 5. Filtrar documentos
    const documentosFiltrados = documentos.filter((documento: any) => {
      const tipoDocumentoOk =
        tiposDocumentosArray.length === 0 ||
        tiposDocumentosArray.includes(documento.tipo_id);

      const dependenciaOk =
        !documento.metadatos ||
        Object.keys(documento.metadatos).length === 0 ||
        dependenciasAuditado.includes(
          documento.metadatos?.dependencia_id,
        );

      const firmaOk =
        documento.metadatos?.firmado === true ||
        documento.metadatos?.firmado === false;

      return (tipoDocumentoOk && dependenciaOk) || firmaOk;
    });

    if (!documentosFiltrados.length) {
      throw new NotFoundException(
        'No hay documentos que cumplan los criterios de filtrado',
      );
    }

    return documentosFiltrados;
  }
}
