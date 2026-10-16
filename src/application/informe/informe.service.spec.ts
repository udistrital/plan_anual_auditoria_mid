import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { InformeService } from './informe.service';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { AuditoriaService } from 'src/application/auditoria/auditoria.service';

describe('InformeService', () => {
  let service: InformeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InformeService,
        {
          provide: AuditoriaCrudService,
          useValue: {}
        },
        {
          provide: AuditoriaService,
          useValue: {}
        },
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
            post: jest.fn(),
            put: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<InformeService>(InformeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
