import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuditoriaOrdenadaService } from './auditoria-ordenada.service';

@Module({
  imports: [HttpModule],
  providers: [AuditoriaOrdenadaService],
  exports: [AuditoriaOrdenadaService],
})
export class AuditoriaOrdenadaModule {}
