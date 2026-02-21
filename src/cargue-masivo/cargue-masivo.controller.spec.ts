import { Test, TestingModule } from '@nestjs/testing';
import { CargueMasivoController } from './cargue-masivo.controller';
import { CargueMasivoService } from './cargue-masivo.service';
import { NuxeoService } from 'src/utils/axios/nuxeo.service';

describe('CargueMasivoController', () => {
  let controller: CargueMasivoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CargueMasivoController],
      providers: [
        {
          provide: CargueMasivoService,
          useValue: {
            agregarValidaciones: jest.fn(),
            cargarAuditorias: jest.fn(),
          },
        },
        {
          provide: NuxeoService,
          useValue: {
            obtenerPorUUID: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<CargueMasivoController>(CargueMasivoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
