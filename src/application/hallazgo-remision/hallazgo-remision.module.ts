import { Module } from '@nestjs/common';
import { HallazgoRemisionService } from './hallazgo-remision.service';
import { HallazgoRemisionController } from './hallazgo-remision.controller';
import { ServicesModule } from 'src/shared/services/services.module';
import { DominiosModule } from 'src/shared/utils/dominios/dominios.module';

@Module({
  imports: [DominiosModule, ServicesModule],
  controllers: [HallazgoRemisionController],
  providers: [HallazgoRemisionService],
})
export class HallazgoRemisionModule {}
