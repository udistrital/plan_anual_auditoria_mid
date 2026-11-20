import { ApiProperty } from '@nestjs/swagger';

export class HallazgoExternoDto {
  @ApiProperty({ description: 'Id de la vigencia del hallazgo (Parámetros).' })
  vigencia_pad: number;

  @ApiProperty({ description: 'Código de auditoría del ente de control.' })
  codigo_auditoria_pad: string;

  @ApiProperty({ description: 'Número de hallazgo en el informe.' })
  numeral: string;

  @ApiProperty({ description: 'Descripción (corta) del hallazgo.' })
  descripcion: string;

  @ApiProperty({
    description: 'Ids de las dependencias (Oikos) responsables.',
    type: [Number],
  })
  dependencia_id: number[];
}

export class DocumentoInformeDto {
  @ApiProperty({ description: 'Id del documento del informe en Nuxeo.' })
  nuxeo_id: number;

  @ApiProperty({ description: 'Enlace del documento del informe en Nuxeo.' })
  nuxeo_enlace: string;
}

export class RegistrarAuditoriaExternaDto {
  @ApiProperty({ description: 'Código del ente de control.' })
  codigo_entidad: string;

  @ApiProperty({ description: 'Nombre del ente de control.' })
  nombre_entidad: string;

  @ApiProperty({ description: 'Nombre de la auditoría.' })
  nombre_auditoria: string;

  @ApiProperty({ description: 'Fecha de emisión del informe final (ISO).' })
  fecha_informe_final: string;

  @ApiProperty({
    description: 'Id de la vigencia de la auditoría (Parámetros).',
  })
  vigencia_id: number;

  @ApiProperty({
    description: 'Hallazgos del informe (de 1 a 500).',
    type: [HallazgoExternoDto],
  })
  hallazgos: HallazgoExternoDto[];

  @ApiProperty({
    description: 'Informe final en PDF, ya subido a Nuxeo por el cliente.',
    type: DocumentoInformeDto,
  })
  documento: DocumentoInformeDto;

  @ApiProperty({ description: 'Id (tercero) de quien registra.' })
  usuario_id: number;

  @ApiProperty({
    description: 'Código del rol con que registra (p. ej. AUDITOR).',
  })
  usuario_rol: string;
}
