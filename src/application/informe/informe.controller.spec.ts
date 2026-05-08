import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { InformeController } from './informe.controller';
import { InformeService } from './informe.service';

describe('InformeController', () => {
  let controller: InformeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InformeController],
      providers: [
        InformeService,
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
            post: jest.fn(),
            put: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<InformeController>(InformeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
