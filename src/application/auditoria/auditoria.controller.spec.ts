import { Test, TestingModule } from '@nestjs/testing';
import { AuditoriaController } from './auditoria.controller';
import { AuditoriaService } from './auditoria.service';

describe('AuditoriaController', () => {
  let controller: AuditoriaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditoriaController],
      providers: [
        {
          provide: AuditoriaService,
          useValue: {
            getAll: jest.fn(),
            getByAuditor: jest.fn(),
            getByDependencia: jest.fn(),
            getOne: jest.fn(),
            deleteAuditoria: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuditoriaController>(AuditoriaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
