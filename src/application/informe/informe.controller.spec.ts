import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { InformeController } from './informe.controller';
import { InformeService } from './informe.service';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

describe('InformeController', () => {
  let controller: InformeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InformeController],
      providers: [
        InformeService,
        { provide: HttpService, useValue: {}, },
        { provide: AuditoriaCrudService, useValue: {}, },
        { provide: AuditoriaService, useValue: {}, }
      ],
    }).compile();

    controller = module.get<InformeController>(InformeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
