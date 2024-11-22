export class PlantillaDto {
  actividad: string;
  enero?: string;
  febrero?: string;
  marzo?: string;
  abril?: string;
  mayo?: string;
  junio?: string;
  julio?: string;
  agosto?: string;
  septiembre?: string;
  octubre?: string;
  noviembre?: string;
  diciembre?: string;
}


export class jsonPlantillaDto {
    plantilla_id: string;
    data: {
      codigo: string;
      proceso: string;
      objetivo: string;
      alcance: string;
      criterios: string;
      recursos: string;
      items: PlantillaDto[];
    };
}