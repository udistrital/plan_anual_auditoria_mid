import { Test, TestingModule } from '@nestjs/testing';
import { PlantillaController } from './plantilla.controller';
import { PlantillaService } from './services/plantilla.service';
import { PlantillaPlanTrabajoService } from './services/plantilla-plan-trabajo.service';
import { PlantillaSolicitudInformacionService } from './services/plantilla-solicitud-informacion.service';
import { PlantillaCartaPresentacionService } from './services/plantilla-carta-presentacion.service';
import { PlantillaProgramaAuditoriaService } from './services/plantilla-programa-auditoria.service';
import { PlantillaInformeSeguimientoService } from './services/plantilla-informe-seguimiento.service';
import { PlantillaInformeAuditoriaService } from './services/plantilla-informe-auditoria.service';

describe('PlantillaController', () => {
  let controller: PlantillaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlantillaController],
      providers: [
        {
          provide: PlantillaService,
          useValue: {
            getOne: jest.fn(),
          },
        },
        {
          provide: PlantillaPlanTrabajoService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: PlantillaSolicitudInformacionService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: PlantillaCartaPresentacionService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: PlantillaProgramaAuditoriaService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: PlantillaInformeSeguimientoService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: PlantillaInformeAuditoriaService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PlantillaController>(PlantillaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
