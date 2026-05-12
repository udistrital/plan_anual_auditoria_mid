import { developmentConfig } from './config.development';
import { productionConfig } from './config.production';
import { defaultConfig } from './config.default';

export const env = () => ({
  NODE_ENV: process.env.NODE_ENV || 'production',
  PARAMETROS_SERVICE: process.env.PARAMETROS_SERVICE,
  PLAN_AUDITORIA_MID_PORT: process.env.PLAN_AUDITORIA_MID_PORT,
  PLAN_AUDITORIA_CRUD_SERVICE: process.env.PLAN_AUDITORIA_CRUD_SERVICE,
  PLANTILLAS_MID_SERVICE: process.env.PLANTILLAS_MID_SERVICE,
  CARGUE_MASIVO_SERVERLESS_MID: process.env.CARGUE_MASIVO_SERVERLESS_MID,
  TERCEROS_SERVICE: process.env.TERCEROS_SERVICE,
  OIKOS_SERVICE: process.env.OIKOS_SERVICE,
  GESTOR_DOCUMENTAL_SERVICE: process.env.GESTOR_DOCUMENTAL_SERVICE,
});

const environmentConf = () => {
  const envConfig =
    process.env.NODE_ENV === 'production'
      ? productionConfig
      : developmentConfig;
  return {
    ...defaultConfig,
    ...envConfig,
  };
};

export const environment = environmentConf();
