import { Injectable } from '@nestjs/common';

@Injectable()
export class CargueMasivoService {

    crearEstructura(base64data: string, planAuditoriaId: number, typeUpload: string): any {
        return {
            base64data: base64data,
            service: process.env.PLAN_ANUAL_AUDITORIA_CRUD,
            endpoint: "auditoria",
            complement: {
                plan_auditoria_id: planAuditoriaId,
            },
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
                        "Feb": 6795,
                        "Mar": 6780,
                        "Abr": 6781,
                        "May": 6782,
                        "Jun": 6783,
                        "Jul": 6784,
                        "Ago": 6785,
                        "Sep": 6786,
                        "Oct": 6787,
                        "Nov": 6788,
                        "Dic": 6789
                    },
                },
            },
        };
        
    }
}