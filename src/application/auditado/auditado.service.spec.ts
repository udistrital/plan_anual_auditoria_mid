import { Test, TestingModule } from '@nestjs/testing';
import { AuditadoService } from './auditado.service';

describe('AuditadoService', () => {
  let service: AuditadoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditadoService],
    }).compile();

    service = module.get<AuditadoService>(AuditadoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
