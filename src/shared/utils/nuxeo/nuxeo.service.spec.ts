import { Test, TestingModule } from "@nestjs/testing";
import { NuxeoService } from "./nuxeo.service";
import { GestorDocumentalService } from "../../services/gestor-documental/gestor-documental.service";

describe("NuxeoService", () => {
  let service: NuxeoService;
  let gestorDocumentalServiceGet: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NuxeoService, GestorDocumentalService],
    }).compile();

    const gestorDocumentalService = module.get<GestorDocumentalService>(GestorDocumentalService);
    service = module.get<NuxeoService>(NuxeoService);
    gestorDocumentalServiceGet = jest.spyOn(gestorDocumentalService, "get");
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should return a file URL when obtenerPorUUID is called with a valid UUID", async () => {
    const mockUUID = "valid-uuid";
    const mockFileURL = "http://example.com/file.pdf";
    gestorDocumentalServiceGet.mockResolvedValue({ file: mockFileURL });

    const endpoint = `document/${mockUUID}`;
    const result = await service.obtenerPorUUID(mockUUID);
    expect(result).toBe(mockFileURL);
    expect(gestorDocumentalServiceGet).toHaveBeenCalledWith(endpoint);
  });

  it("should return an empty string when obtenerPorUUID is called and the response does not contain a file", async () => {
    const mockUUID = "invalid-uuid";
    gestorDocumentalServiceGet.mockResolvedValue({});

    const endpoint = `document/${mockUUID}`;
    const result = await service.obtenerPorUUID(mockUUID);
    expect(result).toBe("");
    expect(gestorDocumentalServiceGet).toHaveBeenCalledWith(endpoint);
  });

  it("should return an empty string when obtenerPorUUID is called and an error occurs", async () => {
    const mockUUID = "error-uuid";
    gestorDocumentalServiceGet.mockRejectedValue(new Error("Network error"));

    const endpoint = `document/${mockUUID}`;
    const result = await service.obtenerPorUUID(mockUUID);
    expect(result).toBe("");
    expect(gestorDocumentalServiceGet).toHaveBeenCalledWith(endpoint);
  });
});
