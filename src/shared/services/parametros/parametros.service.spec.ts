import { Test, TestingModule } from '@nestjs/testing';
import { ParametrosService } from './parametros.service';
import { environment } from 'src/config/configuration';
import { HttpModule, HttpService } from '@nestjs/axios';
import AxiosMockAdapter from 'axios-mock-adapter';
import { catchError, firstValueFrom } from 'rxjs';

describe('ParametrosService', () => {
  let service: ParametrosService;
  let httpService: HttpService;
  let axiosMock: AxiosMockAdapter;
  const urlPrefix = environment.PARAMETROS_SERVICE + '/';
  const serviceName = 'ParametrosService';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [HttpModule],
      providers: [ParametrosService],
    }).compile();

    service = module.get<ParametrosService>(ParametrosService);
    httpService = module.get<HttpService>(HttpService);
    axiosMock = new AxiosMockAdapter(httpService.axiosRef);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });


  it('should perform a GET request to the extended URL', async () => {
    const endpoint = 'test-endpoint';
    const mockResponse = { data: 'test data' };
    const extendedUrl = urlPrefix + endpoint;
    axiosMock.onGet(extendedUrl).reply(200, mockResponse);

    try {
      const response = await firstValueFrom(
        service.get(endpoint).pipe(
          catchError(error => { throw error; })
        )
      );
      expect(response).toEqual(mockResponse);
    } catch (error) {
      expect(error).toBeUndefined();
    };
  });

  it('should throw an error with a detailed message when GET request fails', async () => {
    const endpoint = 'test-endpoint';
    const mockErrorPayload = { message: 'External error' };
    const extendedUrl = urlPrefix + endpoint;
    axiosMock.onGet(extendedUrl).reply(500, mockErrorPayload);

    let errorMessage = `${serviceName} : get : Error on endpoint ${endpoint}: `;
    errorMessage += `Request failed with status code 500: ${JSON.stringify(mockErrorPayload)}`;

    try {
      console.log(typeof service.get(endpoint));
      const response = await firstValueFrom(
        service.get(endpoint).pipe(
          catchError(error => { throw error; })
        )
      );
      expect(response).toBeUndefined();
    } catch (error) {
      expect(error.message).toBe(errorMessage);
    }
  });

  it('should trhow an error with a detailed message when GET request throws an unexpected error', async () => {
    const endpoint = 'test-endpoint';
    const mockError = new Error('Unexpected error');
    const spy = jest.spyOn(httpService, 'get').mockImplementation(() => { throw mockError; });

    let errorMessage = `${serviceName} : get : Error on endpoint ${endpoint}: Error setting up the request: ${mockError.message}`;

    try {
      const response = await firstValueFrom(
        service.get(endpoint).pipe(
          catchError(error => { throw error; })
        )
      );
      expect(response).toBeUndefined();
    } catch (error) {
      expect(error.message).toBe(errorMessage);
    }
  });


  it('should perform a POST request to the extended URL', async () => {
    const endpoint = 'test-endpoint';
    const element = { key: 'value' };
    const mockResponse = { data: 'est data' };
    const extendedUrl = urlPrefix + endpoint;
    axiosMock.onPost(extendedUrl, element).reply(200, mockResponse);

    try {
      const response = await firstValueFrom(
        service.postAny(endpoint, element).pipe(
          catchError(error => { throw error; })
        )
      );
      expect(response).toEqual(mockResponse);
    } catch (error) {
      expect(error).toBeUndefined();
    }
  });

  it('should throw an error with a detailed message when POST request fails', async () => {
    const endpoint = 'test-endpoint';
    const element = { key: 'value' };
    const mockErrorPayload = { message: 'External error' };
    const extendedUrl = urlPrefix + endpoint;
    axiosMock.onPost(extendedUrl, element).reply(500, mockErrorPayload);

    let errorMessage = `${serviceName} : postAny : Error on endpoint ${endpoint}: `;
    errorMessage += `Request failed with status code 500: ${JSON.stringify(mockErrorPayload)}`;

    try {
      const response = await firstValueFrom(
        service.postAny(endpoint, element).pipe(
          catchError(error => { throw error; })
        )
      );
      expect(response).toBeUndefined();
    } catch (error) {
      expect(error.message).toBe(errorMessage);
    }
  });

  it('should trhow an error with a detailed message when POST request throws an unexpected error', async () => {
    const endpoint = 'test-endpoint';
    const element = { key: 'value' };
    const mockError = new Error('Unexpected error');
    const spy = jest.spyOn(httpService, 'post').mockImplementation(() => { throw mockError; });

    let errorMessage = `${serviceName} : postAny : Error on endpoint ${endpoint}: Error setting up the request: ${mockError.message}`;
    
    try {
      const response = await firstValueFrom(
        service.postAny(endpoint, element).pipe(
          catchError(error => { throw error; })
        )
      );
      expect(response).toBeUndefined();
    } catch (error) {
      expect(error.message).toBe(errorMessage);
    }
  });

});
