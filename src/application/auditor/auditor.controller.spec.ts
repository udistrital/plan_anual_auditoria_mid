import { Test, TestingModule } from '@nestjs/testing';
import { AuditorController } from './auditor.controller';
import { AuditorService } from './auditor.service';

describe('AuditorController', () => {
  let controller: AuditorController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditorController],
      providers: [
        {
          provide: AuditorService,
          useValue: {
            getAll: jest.fn(),
            getOne: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuditorController>(AuditorController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
