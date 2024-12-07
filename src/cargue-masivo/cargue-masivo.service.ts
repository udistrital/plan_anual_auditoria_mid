import { Injectable } from '@nestjs/common';

@Injectable()
export class CargueMasivoService {
    
    crearEstructura(base64data: string, complement: Object, typeUpload: string): any {
        return {
            base64data: base64data,
            service: process.env.PLAN_AUDITORIA_CRUD_SERVICE,
            endpoint: "auditoria",
            complement:  complement,
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
}