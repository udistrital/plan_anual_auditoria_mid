import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ComentarioAccionService } from './comentario-accion.service';
import { CrearComentarioAccionDto } from './dto/crear-comentario-accion.dto';

@ApiTags('Foro de la acción de mejora')
@Controller('accion-mejora/:accionId/comentario')
export class ComentarioAccionController {
  constructor(
    private readonly comentarioAccionService: ComentarioAccionService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Lista los comentarios del foro de una acción (más recientes primero) con autor, rol y dependencia, e indica si la persona puede comentar.',
  })
  @ApiParam({
    name: 'accionId',
    required: true,
    description: 'Id (ObjectId) de la acción de mejora.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Comentarios por página (1 a 100, por defecto 20).',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Desplazamiento (por defecto 0).',
  })
  @ApiQuery({
    name: 'persona_id',
    required: false,
    description: 'Tercero que consulta, para calcular MetaData.puede_comentar.',
  })
  @ApiQuery({
    name: 'rol',
    required: false,
    description:
      'Código del rol con que consulta, para calcular MetaData.puede_comentar.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Comentarios (Data puede ser []); MetaData: { Count, puede_comentar }.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Id de la acción, limit u offset inválidos.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'La acción de mejora no existe o está inactiva.',
  })
  async listar(@Param('accionId') accionId: string, @Query() query: any) {
    return this.comentarioAccionService.listar(accionId, query);
  }

  @Post()
  @ApiOperation({
    summary:
      'Publica un comentario en el foro de la acción. Pueden comentar las dependencias responsables y el personal de Control Interno.',
  })
  @ApiParam({
    name: 'accionId',
    required: true,
    description: 'Id (ObjectId) de la acción de mejora.',
  })
  @ApiBody({ type: CrearComentarioAccionDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Comentario creado, con autor, rol y dependencia resueltos.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Mensaje vacío o de más de 1000 caracteres, usuario o rol inválidos.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'El usuario no participa en el foro de esta acción.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'La acción de mejora no existe o está inactiva.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_GATEWAY,
    description: 'El CRUD no registró el comentario.',
  })
  async publicar(
    @Param('accionId') accionId: string,
    @Body() body: CrearComentarioAccionDto,
  ) {
    return this.comentarioAccionService.publicar(accionId, body);
  }
}
