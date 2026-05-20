import { Module } from '@nestjs/common';
import { PlanMejoramientoController } from './plan-mejoramiento.controller';
import { PlanMejoramientoService } from './plan-mejoramiento.service';
import { ServicesModule } from 'src/shared/services/services.module';
import { DominiosModule } from 'src/shared/utils/dominios/dominios.module';

@Module({
  imports: [ServicesModule, DominiosModule],
  controllers: [PlanMejoramientoController],
  providers: [PlanMejoramientoService],
})
export class PlanMejoramientoModule {}
