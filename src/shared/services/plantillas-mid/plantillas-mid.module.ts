import { Module } from '@nestjs/common';
import { PlantillasMidService } from './plantillas-mid.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  providers: [PlantillasMidService],
  exports: [PlantillasMidService],
})
export class PlantillasMidModule {}
