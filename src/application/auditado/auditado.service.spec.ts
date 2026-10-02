import { Test, TestingModule } from '@nestjs/testing';
import { AuditadoService } from './auditado.service';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { TercerosHelperService } from 'src/shared/services/terceros-helper.service';

describe('AuditadoService', () => {
  let service: AuditadoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditadoService,
        {
          provide: AuditoriaCrudService,
          useValue: {},
        },
        {
          provide: TercerosHelperService,
          useValue: {},
        }
      ],
    }).compile();

    service = module.get<AuditadoService>(AuditadoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
