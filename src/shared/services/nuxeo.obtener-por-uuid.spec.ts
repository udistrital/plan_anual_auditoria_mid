import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { NuxeoService } from './nuxeo.service';
import { LoggerService } from './logger.service';
import {
  contenidoNuxeoBase64,
  htmlConImagen,
  respuestaNuxeo,
} from '../../../test/fixtures/plantilla';

describe('NuxeoService.obtenerPorUUID', () => {
  let service: NuxeoService;
  const httpServiceMock = { get: jest.fn() };
  const configServiceMock = {
    get: jest.fn().mockReturnValue('http://gestor-documental'),
  };
  const loggerMock = { error: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NuxeoService,
        { provide: HttpService, useValue: httpServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: LoggerService, useValue: loggerMock },
      ],
    }).compile();

    service = module.get<NuxeoService>(NuxeoService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('devuelve el archivo del documento consultado en el gestor documental', async () => {
    const file = contenidoNuxeoBase64(htmlConImagen);
    httpServiceMock.get.mockReturnValue(of(respuestaNuxeo(file)));

    const resultado = await firstValueFrom(service.obtenerPorUUID('uuid-123'));

    expect(resultado).toBe(file);
    expect(httpServiceMock.get).toHaveBeenCalledWith(
      'http://gestor-documental/document/uuid-123',
    );
    expect(loggerMock.error).not.toHaveBeenCalled();
  });

  it('devuelve vacío y registra el error cuando la respuesta no trae file', async () => {
    httpServiceMock.get.mockReturnValue(of(respuestaNuxeo()));

    const resultado = await firstValueFrom(service.obtenerPorUUID('uuid-123'));

    expect(resultado).toBe('');
    expect(loggerMock.error).toHaveBeenCalledTimes(1);
    expect(loggerMock.error.mock.calls[0][0].message).toContain(
      'La respuesta no tiene el formato esperado.',
    );
  });

  it('devuelve vacío y registra el error cuando falla la petición al gestor documental', async () => {
    httpServiceMock.get.mockReturnValue(
      throwError(() => new Error('Request failed with status code 404')),
    );

    const resultado = await firstValueFrom(service.obtenerPorUUID('uuid-404'));

    expect(resultado).toBe('');
    expect(loggerMock.error).toHaveBeenCalledTimes(1);
    expect(loggerMock.error.mock.calls[0][0].message).toContain(
      'NuxeoService : obtenerPorUUID : Error con UUID document/uuid-404',
    );
  });
});
