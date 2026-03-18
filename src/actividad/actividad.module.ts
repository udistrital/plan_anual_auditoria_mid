import { Module } from '@nestjs/common';
import { ActividadService } from './actividad.service';
import { ActividadController } from './actividad.controller';
import { HttpModule } from '@nestjs/axios';
import { AuditoriaCrudModule } from 'src/shared/services/auditoria-crud/auditoria-crud.module';

@Module({
  imports: [HttpModule, AuditoriaCrudModule],
  controllers: [ActividadController],
  providers: [ActividadService],
})
export class ActividadModule {}
