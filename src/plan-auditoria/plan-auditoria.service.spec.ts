import { Test, TestingModule } from '@nestjs/testing';
import { PlanAuditoriaService } from './plan-auditoria.service';

describe('PlanAuditoriaService', () => {
  let service: PlanAuditoriaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlanAuditoriaService],
    }).compile();

    service = module.get<PlanAuditoriaService>(PlanAuditoriaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
