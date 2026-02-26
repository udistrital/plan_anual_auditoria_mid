import { Test, TestingModule } from "@nestjs/testing";
import { firstValueFrom, of, throwError } from "rxjs";
import { DominiosModule } from "./dominios.module";
import { DominiosService } from "./dominios.service";
import { ParametrosService } from "src/shared/services/parametros/parametros.service";
import { OikosService } from "src/shared/services/oikos/oikos.service";
import { environment } from "src/config/configuration";
import { ParametrosModule } from "src/shared/services/parametros/parametros.module";
import { OikosModule } from "src/shared/services/oikos/oikos.module";
import { DOMINIOS_CONFIG } from "./dominios.config";

describe("DominiosService", () => {
  let service: DominiosService;
  let parametrosServiceGet: jest.SpyInstance;
  let oikosServiceGet: jest.SpyInstance;
  const ORIGINAL_TIPO_PARAMETRO = environment.TIPO_PARAMETRO;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DominiosModule, ParametrosModule, OikosModule],
    }).compile();


    const parametrosService = module.get<ParametrosService>(ParametrosService);
    const oikosService = module.get<OikosService>(OikosService);
    parametrosServiceGet = jest.spyOn(parametrosService, "get");
    oikosServiceGet = jest.spyOn(oikosService, "get");

    service = module.get<DominiosService>(DominiosService);
  });

  afterEach(() => {
    environment.TIPO_PARAMETRO = ORIGINAL_TIPO_PARAMETRO;
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should return the parameter name when getNombreTipoParametro is called with a valid tipoParametroId", async () => {
    const mockTipoParametroId = 1;
    const mockTipoParametroName = "Test Parameter";
    (environment as any).TIPO_PARAMETRO = { [mockTipoParametroName]: mockTipoParametroId };

    const result = service.getNombreTipoParametro(mockTipoParametroId);
    expect(result).toBe(mockTipoParametroName);
  });

  it ("should throw an error when getNombreTipoParametro is called with an invalid tipoParametroId", async () => {
    const invalidTipoParametroId = 999;
    (environment as any).TIPO_PARAMETRO = { VALID_PARAMETER: 1 };

    try {
      service.getNombreTipoParametro(invalidTipoParametroId);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe(`TipoParametroId ${invalidTipoParametroId} not found in environment configuration`);
    }
  });
  

  it("should return the list of parameters when getNombreTipoParametro is called with a valid tipoParametroId", async () => {
    const mockTipoParametroId = 1;
    const mockTipoParametroName = "Test Parameter";
    const mockParametros = [{ id: 1, nombre: "Param1" }, { id: 2, nombre: "Param2" }];
    (environment as any).TIPO_PARAMETRO = { [mockTipoParametroName]: mockTipoParametroId };
    parametrosServiceGet.mockReturnValue(of({ Data: mockParametros }));

    const result = await firstValueFrom(service.getParametros(mockTipoParametroId));
    expect(result.api).toBe(DOMINIOS_CONFIG.NOMBRES_API.PARAMETROS);
    expect(result.nombre).toBe(mockTipoParametroName);
    expect(result.tipoParametroId).toBe(mockTipoParametroId);
    expect(result.parametros).toEqual(mockParametros);
    expect(parametrosServiceGet).toHaveBeenCalledWith(`parametro?query=Activo:true,TipoParametroId:${mockTipoParametroId}&fields=Id,Nombre&limit=0`);
  });

  it("should throw an error when getParametros is called and the response format is invalid", async () => {
    const mockTipoParametroId = 1;
    const mockTipoParametroName = "Test Parameter";
    (environment as any).TIPO_PARAMETRO = { [mockTipoParametroName]: mockTipoParametroId };
    parametrosServiceGet.mockReturnValue(of({ InvalidData: [] }));

    try {
      await firstValueFrom(service.getParametros(mockTipoParametroId));
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('DominiosService : getParametros : Error: Invalid response format: missing Data property');
    }
  });


  it("should return the list of dependencies when getDependencias is called", async () => {
    const mockDependencias = [{ id: 1, nombre: "Dep1" }, { id: 2, nombre: "Dep2" }];
    oikosServiceGet.mockReturnValue(of(mockDependencias));

    const result = await firstValueFrom(service.getDependencias());
    expect(result.api).toBe(DOMINIOS_CONFIG.NOMBRES_API.OIKOS);
    expect(result.nombre).toBe(DOMINIOS_CONFIG.NOMBRES_OIKOS.DEPENDENCIAS);
    expect(result.tipoParametroId).toBeUndefined();
    expect(result.parametros).toEqual(mockDependencias);
    expect(oikosServiceGet).toHaveBeenCalledWith(`dependencia?query=Activo:true&fields=Id,Nombre&limit=0`);
  });

  it("should throw an error when getDependencias is called and the response format is invalid", async () => {
    oikosServiceGet.mockReturnValue(of({ InvalidData: [] }));

    try {
      await firstValueFrom(service.getDependencias());
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('DominiosService : getDependencias : Error: Invalid response format: missing Data property');
    }
  });

});
