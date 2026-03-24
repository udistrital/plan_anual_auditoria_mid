import { Test, TestingModule } from '@nestjs/testing';
import { ActividadService } from './actividad.service';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud/auditoria-crud.service';

describe('ActividadService', () => {
  let service: ActividadService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActividadService,
        {
          provide: AuditoriaCrudService,
          useValue: {
            traerDataCrud: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ActividadService>(ActividadService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
