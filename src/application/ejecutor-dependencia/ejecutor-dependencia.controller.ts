import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { EjecutorDependenciaService } from './ejecutor-dependencia.service';

@ApiTags('Ejecutor por Dependencia')
@Controller('ejecutor-dependencia')
export class EjecutorDependenciaController {
  constructor(
    private readonly ejecutorDependenciaService: EjecutorDependenciaService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Lista las dependencias con su(s) ejecutor(es) vigente(s), con nombre de dependencia y de usuario.',
  })
  @ApiQuery({ name: 'dependencia_id', required: false })
  @ApiQuery({ name: 'usuario_id', required: false })
  @ApiQuery({
    name: 'busqueda',
    required: false,
    description: 'Texto sobre el nombre o código de la dependencia.',
  })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiResponse({ status: 200, description: 'Lista obtenida con éxito.' })
  @ApiResponse({ status: 404, description: 'Error en la consulta.' })
  async getEjecutores(@Res() res: any, @Query() queryParams: any) {
    try {
      const data =
        await this.ejecutorDependenciaService.getEjecutores(queryParams);
      res.status(HttpStatus.OK).json(data);
    } catch (error) {
      res.status(HttpStatus.NOT_FOUND).json({
        Success: false,
        Status: HttpStatus.NOT_FOUND,
        Message: 'Error en servicio GetEjecutores.',
        Data: error.message,
      });
    }
  }

  @Get('dependencia/:dependenciaId/planes')
  @ApiOperation({
    summary:
      'Planes de mejoramiento de la dependencia (cadena auditoría padre → auditoría → plan).',
  })
  @ApiParam({
    name: 'dependenciaId',
    required: true,
    description: 'Código de la dependencia.',
  })
  @ApiResponse({ status: 200, description: 'Lista obtenida con éxito.' })
  @ApiResponse({ status: 404, description: 'Error en la consulta.' })
  async getPlanesPorDependencia(
    @Res() res: any,
    @Param('dependenciaId', ParseIntPipe) dependenciaId: number,
  ) {
    try {
      const data =
        await this.ejecutorDependenciaService.getPlanesPorDependencia(
          dependenciaId,
        );
      res.status(HttpStatus.OK).json(data);
    } catch (error) {
      res.status(HttpStatus.NOT_FOUND).json({
        Success: false,
        Status: HttpStatus.NOT_FOUND,
        Message: 'Error en servicio GetPlanesPorDependencia.',
        Data: error.message,
      });
    }
  }

  @Get('ejecutor/:usuarioId/planes')
  @ApiOperation({
    summary:
      'Planes de mejoramiento asignados a un usuario con rol Ejecutor (vía ejecutor_plan).',
  })
  @ApiParam({
    name: 'usuarioId',
    required: true,
    description: 'ID del usuario (tercero) ejecutor.',
  })
  @ApiResponse({ status: 200, description: 'Lista obtenida con éxito.' })
  @ApiResponse({ status: 404, description: 'Error en la consulta.' })
  async getPlanesPorEjecutor(
    @Res() res: any,
    @Param('usuarioId', ParseIntPipe) usuarioId: number,
  ) {
    try {
      const data =
        await this.ejecutorDependenciaService.getPlanesPorEjecutor(usuarioId);
      res.status(HttpStatus.OK).json(data);
    } catch (error) {
      res.status(HttpStatus.NOT_FOUND).json({
        Success: false,
        Status: HttpStatus.NOT_FOUND,
        Message: 'Error en servicio GetPlanesPorEjecutor.',
        Data: error.message,
      });
    }
  }
}
