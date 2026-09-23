import { Test, TestingModule } from '@nestjs/testing';
import { PlanAuditoriaController } from './plan-auditoria.controller';
import { PlanAuditoriaService } from './plan-auditoria.service';
import { GeneracionAuditoriaService } from 'src/shared/services/generacion-auditoria.service';

describe('PlanAuditoriaController', () => {
  let controller: PlanAuditoriaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanAuditoriaController,
        { provide: PlanAuditoriaService, useValue: {} },
        { provide: GeneracionAuditoriaService, useValue: {} },
      ],
    }).compile();

    controller = module.get<PlanAuditoriaController>(PlanAuditoriaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
