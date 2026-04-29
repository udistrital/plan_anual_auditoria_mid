import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  const appServiceMock = {
    healthCheck: jest.fn().mockReturnValue({ Status: 'ok', checkCount: 0 }),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: AppService, useValue: appServiceMock }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return health check payload', () => {
      expect(appController.healthCheck()).toEqual({
        Status: 'ok',
        checkCount: 0,
      });
    });
  });
});
