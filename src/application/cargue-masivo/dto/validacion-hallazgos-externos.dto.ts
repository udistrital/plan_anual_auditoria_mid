import { ApiProperty } from '@nestjs/swagger';

export class ValidacionHallazgosExternosDto {
  @ApiProperty({
    description:
      'Archivo xlsx de la plantilla de hallazgos de auditorías externas, en Base64.',
  })
  base64data: string;
}
