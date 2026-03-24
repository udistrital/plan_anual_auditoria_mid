import { Test, TestingModule } from '@nestjs/testing';
import { PlanAuditoriaService } from './plan-auditoria.service';
import { HttpService } from '@nestjs/axios';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud/auditoria-crud.service';

describe('PlanAuditoriaService', () => {
  let service: PlanAuditoriaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanAuditoriaService,
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: AuditoriaCrudService,
          useValue: {
            traerDataCrud: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PlanAuditoriaService>(PlanAuditoriaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
