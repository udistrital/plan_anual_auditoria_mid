import { Test, TestingModule } from '@nestjs/testing';
import { PlantillaService } from './services/plantilla.service';
import { HttpService } from '@nestjs/axios';
import { DominiosService } from 'src/shared/utils/dominios/dominios.service';

describe('PlantillaService', () => {
  let service: PlantillaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlantillaService,
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
            post: jest.fn(),
          },
        },
        {
          provide: DominiosService,
          useValue: {
            getParametros: jest.fn(),
            getDependencias: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PlantillaService>(PlantillaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
