import developmentConfig from './config.development';
import productionConfig from './config.production';
import defaultConfig from './config.default';

export const environment = () => {
  const envConfig = process.env.NODE_ENV === 'production' ? productionConfig() : developmentConfig();
  return {
    ...envConfig,
    ...defaultConfig(),
  };
}
