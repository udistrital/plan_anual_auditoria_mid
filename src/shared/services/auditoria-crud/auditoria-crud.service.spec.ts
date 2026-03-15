import { Test, TestingModule } from '@nestjs/testing';
import { AuditoriaCrudService } from './auditoria-crud.service';
import { environment } from 'src/config/configuration';
import { HttpModule, HttpService } from '@nestjs/axios';
import AxiosMockAdapter from 'axios-mock-adapter';

describe('AuditoriaCrudService', () => {
  let service: AuditoriaCrudService;
  let httpService: HttpService;
  let axiosMock: AxiosMockAdapter;
  const urlPrefix = environment.PLAN_AUDITORIA_CRUD_SERVICE + '/';
  const serviceName = 'AuditoriaCrudService';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [HttpModule],
      providers: [AuditoriaCrudService],
    }).compile();

    service = module.get<AuditoriaCrudService>(AuditoriaCrudService);
    httpService = module.get<HttpService>(HttpService);
    axiosMock = new AxiosMockAdapter(httpService.axiosRef);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });


  it('should perform a GET request to the extended URL', async () => {
    const endpoint = 'auditoria';
    const mockResponse = { data: 'test data' };
    const extendedUrl = urlPrefix + endpoint;
    axiosMock.onGet(extendedUrl).reply(200, mockResponse);

    try {
      const response = await service.traerDataCrud(endpoint, null, null);
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
      console.log(typeof service.traerDataCrud(endpoint, null, null));
      const response = await service.traerDataCrud(endpoint, null, null);
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
      const response = await service.traerDataCrud(endpoint, null, null);
      expect(response).toBeUndefined();
    } catch (error) {
      expect(error.message).toBe(errorMessage);
    }
  });

});
