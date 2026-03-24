import { Test, TestingModule } from '@nestjs/testing';
import { CargueMasivoService } from './cargue-masivo.service';
import { DominiosService } from 'src/shared/utils/dominios/dominios.service';

describe('CargueMasivoService', () => {
  let service: CargueMasivoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CargueMasivoService,
        {
          provide: DominiosService,
          useValue: {
            getParametros: jest.fn(),
            getDependencias: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CargueMasivoService>(CargueMasivoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
