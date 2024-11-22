import { Test, TestingModule } from '@nestjs/testing';
import { PlantillaController } from './plantilla.controller';

describe('PlantillaController', () => {
  let controller: PlantillaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlantillaController],
    }).compile();

    controller = module.get<PlantillaController>(PlantillaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
