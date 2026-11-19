import { Module } from '@nestjs/common';
import { ServicesModule } from 'src/shared/services/services.module';
import { DominiosModule } from 'src/shared/utils/dominios/dominios.module';
import { AuditoriaExternaController } from './auditoria-externa.controller';
import { AuditoriaExternaRepositorio } from './auditoria-externa.repositorio';
import { AuditoriaExternaService } from './auditoria-externa.service';

@Module({
  imports: [ServicesModule, DominiosModule],
  controllers: [AuditoriaExternaController],
  providers: [AuditoriaExternaService, AuditoriaExternaRepositorio],
})
export class AuditoriaExternaModule {}
