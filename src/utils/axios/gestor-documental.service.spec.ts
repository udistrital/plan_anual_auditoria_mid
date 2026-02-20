import { Test, TestingModule } from '@nestjs/testing';
import { GestorDocumentalService } from './gestor-documental.service';
import { environment } from 'src/config/configuration';
import axios from 'axios';

describe('GestorDocumentalService', () => {
  let service: GestorDocumentalService;
  let axiosGetSpy: jest.SpyInstance;
  let axiosPostSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GestorDocumentalService],
    }).compile();

    service = module.get<GestorDocumentalService>(GestorDocumentalService);
    axiosGetSpy = jest.spyOn(axios, 'get');
    axiosPostSpy = jest.spyOn(axios, 'post');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should perform a GET request to the extended URL', async () => {
    const endpoint = 'test-endpoint';
    const mockResponse = { data: 'test data' };
    axiosGetSpy.mockResolvedValue(mockResponse);

    const extendedUrl = `${environment.GESTOR_DOCUMENTAL_SERVICE}/${endpoint}`;
    const response = await service.get(endpoint);
    expect(axiosGetSpy).toHaveBeenCalledWith(extendedUrl);
    expect(response).toEqual(mockResponse.data);
  });

  it('should throw an error with a detailed message when GET request fails', async () => {
    const endpoint = 'test-endpoint';
    const mockError = new Error('Network error');
    axiosGetSpy.mockRejectedValue(mockError);

    await expect(service.get(endpoint)).rejects.toThrow(
      `GestorDocumentalService : Get : Error con endpoint ${endpoint}: ${mockError.message}`
    );
  });


  it('should perform a POST request to the extended URL', async () => {
    const endpoint = 'test-endpoint';
    const element = { key: 'value' };
    const mockResponse = { data: 'test data' };
    axiosPostSpy.mockResolvedValue(mockResponse);

    const extendedUrl = `${environment.GESTOR_DOCUMENTAL_SERVICE}/${endpoint}`;
    const response = await service.postAny(endpoint, element);
    expect(axiosPostSpy).toHaveBeenCalledWith(extendedUrl, element);
    expect(response).toEqual(mockResponse.data);
  });

  it('should throw an error with a detailed message when POST request fails', async () => {
    const endpoint = 'test-endpoint';
    const element = { key: 'value' };
    const mockError = new Error('Network error');
    axiosPostSpy.mockRejectedValue(mockError);

    await expect(service.postAny(endpoint, element)).rejects.toThrow(
      `GestorDocumentalService : PostAny : Error con endpoint ${endpoint}: ${mockError.message}`
    );
  });

});
