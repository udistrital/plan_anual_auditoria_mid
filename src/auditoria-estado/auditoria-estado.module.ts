import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuditoriaEstadoService } from './auditoria-estado.service';
import { AuditoriaEstadoController } from './auditoria-estado.controller';

@Module({
  imports: [HttpModule],
  controllers: [AuditoriaEstadoController],
  providers: [AuditoriaEstadoService],
})
export class AuditoriaEstadoModule {}
