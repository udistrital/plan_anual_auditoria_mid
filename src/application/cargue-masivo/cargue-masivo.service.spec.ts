import { Test, TestingModule } from '@nestjs/testing';
import { CargueMasivoService } from './cargue-masivo.service';
import { HttpService } from '@nestjs/axios';

describe('CargueMasivoService', () => {
  let service: CargueMasivoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CargueMasivoService,
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
            post: jest.fn(),
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
