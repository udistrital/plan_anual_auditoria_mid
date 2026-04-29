import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { AuditoriaCrudService } from './auditoria-crud.service';

describe('AuditoriaCrudService', () => {
  let service: AuditoriaCrudService;
  const httpServiceMock = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditoriaCrudService,
        {
          provide: HttpService,
          useValue: httpServiceMock,
        },
      ],
    }).compile();

    service = module.get<AuditoriaCrudService>(AuditoriaCrudService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should perform a GET request and return data', async () => {
    const endpoint = 'auditoria';
    const mockResponse = { data: 'test data' };
    httpServiceMock.get.mockReturnValue(of({ data: mockResponse }));

    const response = await service.traerDataCrud(endpoint, null, null);

    expect(response).toEqual(mockResponse);
    expect(httpServiceMock.get).toHaveBeenCalledWith(
      expect.stringContaining(endpoint),
    );
  });

  it('should build URL with id and query params', async () => {
    const endpoint = 'auditoria';
    const id = '123';
    const queryParams = { limit: '10', fields: 'titulo' };
    httpServiceMock.get.mockReturnValue(of({ data: { ok: true } }));

    await service.traerDataCrud(endpoint, id, queryParams);

    const calledUrl = httpServiceMock.get.mock.calls[0][0] as string;
    expect(calledUrl).toContain(`${endpoint}/${id}`);
    expect(calledUrl).toContain('limit=10');
    expect(calledUrl).toContain('fields=titulo');
  });

  it('should throw HttpException when GET request fails', async () => {
    const endpoint = 'test-endpoint';
    const mockError = new Error('Request failed');
    httpServiceMock.get.mockReturnValue(throwError(() => mockError));

    await expect(
      service.traerDataCrud(endpoint, null, null),
    ).rejects.toMatchObject({
      response: 'Error al obtener los datos del servicio externo',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  });
});
