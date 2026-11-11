import { ApiProperty } from '@nestjs/swagger';

export class CrearComentarioAccionDto {
  @ApiProperty({
    description: 'Texto plano del comentario (1 a 1000 caracteres)',
    example: 'Se cargarán las firmas de las actas en el próximo corte.',
  })
  mensaje: string;

  @ApiProperty({ description: 'Id del tercero que comenta', example: 101 })
  usuario_id: number;

  @ApiProperty({
    description: 'Código del rol con que comenta',
    example: 'JEFE_DEPENDENCIA',
  })
  usuario_rol: string;
}

/** Comentario del foro tal como lo devuelve el MID. */
export interface ComentarioAccionRespuesta {
  _id: string;
  accion_mejora_id: string;
  mensaje: string;
  fecha_creacion: string;
  usuario_id: number;
  usuario_nombre: string;
  usuario_rol: string;
  rol_nombre: string;
  dependencia_id: number | null;
  dependencia_nombre: string | null;
}
