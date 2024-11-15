import { Module } from '@nestjs/common';
import { PlantillaController } from './plantilla.controller';
import { PlantillaService } from './plantilla.service';

@Module({
  controllers: [PlantillaController],
  providers: [PlantillaService]
})
export class PlantillaModule {}
