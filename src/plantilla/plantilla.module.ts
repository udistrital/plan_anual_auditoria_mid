import { Module } from '@nestjs/common';
import { PlantillaController } from './plantilla.controller';
import { PlantillaService } from './services/plantilla.service';
import { HttpModule } from '@nestjs/axios';
import { PlantillaPlanTrabajoService } from './services/plantilla-plan-trabajo.service';

@Module({
  imports: [HttpModule],
  controllers: [PlantillaController],
  providers: [PlantillaService, PlantillaPlanTrabajoService],
})
export class PlantillaModule {}
