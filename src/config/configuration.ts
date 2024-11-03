import * as dotenv from 'dotenv';

dotenv.config();
export const environment = {
    PLAN_ANUAL_AUDITORIA_PARAMETROS:
        process.env.PLAN_ANUAL_AUDITORIA_PARAMETROS,
        PLAN_ANUAL_AUDITORIA_PORT:
        process.env.PLAN_ANUAL_AUDITORIA_PORT,
        PLAN_ANUAL_AUDITORIA_CRUD:
        process.env.PLAN_ANUAL_AUDITORIA_CRUD,
};