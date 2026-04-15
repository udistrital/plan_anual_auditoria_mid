import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';
import { environment } from 'src/config/configuration';

const {
    PLAN_AUDITORIA_CRUD_SERVICE,
    TERCEROS_SERVICE
} = environment;

@Injectable()
export class AuditadoService {

    constructor(
        private readonly httpService: HttpService
    ) {}

    async filtrarDocumentosPorDependencia(personaId: number, auditoriaId: string, cargoId: number, tipoDocumentoId?: string) {
        const documentosUrl = `${PLAN_AUDITORIA_CRUD_SERVICE}documento?query=referencia_id:${auditoriaId},activo:true`;
        const tiposDocumentosArray = tipoDocumentoId ? tipoDocumentoId.split(',').map(id => parseInt(id, 10)) : [];
        const dependenciasAuditado = await this.obtenerDependenciasPersona(personaId, cargoId);

        const response = await lastValueFrom(this.httpService.get(documentosUrl));
        const documentosFiltrados = response.data.Data.filter((documento: any) => {
            const tipoDocumentoEncontrados = tiposDocumentosArray.length === 0 || tiposDocumentosArray.includes(documento.tipo_id);
            const dependenciaDocumentosEncontrados = dependenciasAuditado.includes(documento.metadatos?.dependencia_id) || documento.metadatos == undefined;
            const firmaDocumentosEncontrados = documento.metadatos?.firmado == true || documento.metadatos?.firmado == false;
            return tipoDocumentoEncontrados && dependenciaDocumentosEncontrados || firmaDocumentosEncontrados;
        });

        return documentosFiltrados;
    }

    private async obtenerDependenciasPersona(personaId: number, cargoId: number): Promise<number[]> {
        const url = `${TERCEROS_SERVICE}vinculacion?query=TerceroPrincipalId:${personaId},Activo:true,CargoId:${cargoId}&fields=DependenciaId`;
        try {
          const response = await lastValueFrom(this.httpService.get(url));
    
          if (!response.data || response.data.length === 0) {
            return [];
          }
          return response.data
            .map((v: any) => v.DependenciaId)
            .filter((id: any) => id != null);
        } catch (error) {
          throw new HttpException(
            'Error al obtener las dependencias del usuario',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      }
}
