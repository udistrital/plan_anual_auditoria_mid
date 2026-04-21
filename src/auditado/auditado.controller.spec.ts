import { Test, TestingModule } from '@nestjs/testing';
import { AuditadoController } from './auditado.controller';
import { AuditadoService } from './auditado.service';

describe('AuditadoController', () => {
  let controller: AuditadoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditadoController],
      providers: [AuditadoService],
    }).compile();

    controller = module.get<AuditadoController>(AuditadoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
