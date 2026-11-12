import { Module } from '@nestjs/common';
import { EjecutorDependenciaController } from './ejecutor-dependencia.controller';
import { EjecutorDependenciaService } from './ejecutor-dependencia.service';
import { ServicesModule } from 'src/shared/services/services.module';
import { DominiosModule } from 'src/shared/utils/dominios/dominios.module';

@Module({
  imports: [ServicesModule, DominiosModule],
  controllers: [EjecutorDependenciaController],
  providers: [EjecutorDependenciaService],
})
export class EjecutorDependenciaModule {}
