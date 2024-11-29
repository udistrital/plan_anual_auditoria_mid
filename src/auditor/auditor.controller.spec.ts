import { Test, TestingModule } from '@nestjs/testing';
import { AuditorController } from './auditor.controller';

describe('AuditorController', () => {
  let controller: AuditorController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditorController],
    }).compile();

    controller = module.get<AuditorController>(AuditorController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
