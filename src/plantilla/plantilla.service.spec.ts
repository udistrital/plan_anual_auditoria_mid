import { Test, TestingModule } from '@nestjs/testing';
import { PlantillaService } from './plantilla.service';

describe('PlantillaService', () => {
  let service: PlantillaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlantillaService],
    }).compile();

    service = module.get<PlantillaService>(PlantillaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
