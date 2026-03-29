import { Test, TestingModule } from '@nestjs/testing';
import { AuditorService } from './auditor.service';
import { HttpService } from '@nestjs/axios';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud/auditoria-crud.service';

describe('AuditorService', () => {
  let service: AuditorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditorService,
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

    service = module.get<AuditorService>(AuditorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
