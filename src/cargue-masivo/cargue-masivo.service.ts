import { Injectable } from '@nestjs/common';
import { environment } from 'src/config/configuration';

@Injectable()
export class CargueMasivoService {
    
    crearEstructura(base64data: string, complemento: Object, tipoCarga: string): any {
        return {
            base64data: base64data,
            service: environment.PLAN_AUDITORIA_CRUD_SERVICE,
            endpoint: "auditoria",
            complement:  complemento,
            structure: {
                titulo: {
                    file_name_column: "Auditoría",
                    required: true,
                },
                tipo_evaluacion_id: {
                    file_name_column: "Tipo de Evaluación",
                    required: true,
                    mapping: {
                        "Auditoria Interna": 6770,
                        "Seguimiento": 6771,
                        "Informe": 6772
                    },
                },
                cronograma_id: {
                    column_group: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
                    mapping: {
                        "Ene": 6779,
                        "Feb": 6780,
                        "Mar": 6781,
                        "Abr": 6782,
                        "May": 6783,
                        "Jun": 6784,
                        "Jul": 6785,
                        "Ago": 6786,
                        "Sep": 6787,
                        "Oct": 6788,
                        "Nov": 6789,
                        "Dic": 6795
                    },
                },
            },
        };
        
    }

    crearEstructuraActividad(base64data: string, complemento: Object, tipoCarga: string): any {
        return {
            base64data: base64data,
            service: environment.PLAN_AUDITORIA_CRUD_SERVICE,
            endpoint: "actividad",
            complement:  complemento,
            structure: {
                titulo: {
                    file_name_column: "Titulo",
                    required: true,
                },
                fecha_inicio: {
                    file_name_column: "Fecha Inicio",
                    required: false,
                },
                fecha_fin: {
                    file_name_column: "Fecha Fin",
                    required: false,
                },
                referencia: {
                    file_name_column: "Referencia",
                    required: false,
                },
                descripcion: {
                    file_name_column: "Descripcion",
                    required: false,
                },
                folio: {
                    file_name_column: "Folio",
                    required: false,
                },
                Medio_id: {
                    file_name_column: "Medio",
                    required: false,
                    mapping: {
                        "Fisico": 6770,
                        "Digital": 6771,
                        "Otro": 6772
                    },
                },
                carpeta: {
                    file_name_column: "Carpeta",
                    required: false,
                },
            },
        };
        
    }
}