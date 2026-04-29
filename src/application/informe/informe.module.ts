import { Module } from '@nestjs/common';
import { InformeController } from './informe.controller';
import { InformeService } from './informe.service';
import { ServicesModule } from 'src/shared/services/services.module';
import { AuditoriaModule } from 'src/application/auditoria/auditoria.module';

@Module({
  imports: [ServicesModule, AuditoriaModule],
  controllers: [InformeController],
  providers: [InformeService],
  exports: [InformeService],
})
export class InformeModule {}