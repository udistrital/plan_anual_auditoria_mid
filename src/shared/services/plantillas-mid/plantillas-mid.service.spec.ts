import { Test, TestingModule } from '@nestjs/testing';
import { PlantillasMidService } from './plantillas-mid.service';

describe('PlantillasMidService', () => {
  let service: PlantillasMidService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlantillasMidService],
    }).compile();

    service = module.get<PlantillasMidService>(PlantillasMidService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
