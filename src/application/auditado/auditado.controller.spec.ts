import { Test, TestingModule } from '@nestjs/testing';
import { AuditadoController } from './auditado.controller';
import { AuditadoService } from './auditado.service';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { TercerosHelperService } from 'src/shared/services/terceros-helper.service';

describe('AuditadoController', () => {
  let controller: AuditadoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditadoController],
      providers: [
        AuditadoService,
        { provide: AuditoriaCrudService, useValue: {}, },
        { provide: TercerosHelperService, useValue: {}, },
      ],
    }).compile();

    controller = module.get<AuditadoController>(AuditadoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
