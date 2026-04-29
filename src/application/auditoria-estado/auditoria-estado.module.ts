import { Module } from '@nestjs/common';
import { AuditoriaEstadoService } from './auditoria-estado.service';
import { AuditoriaEstadoController } from './auditoria-estado.controller';
import { ServicesModule } from 'src/shared/services/services.module';

@Module({
  imports: [ServicesModule],
  controllers: [AuditoriaEstadoController],
  providers: [AuditoriaEstadoService],
})
export class AuditoriaEstadoModule {}
