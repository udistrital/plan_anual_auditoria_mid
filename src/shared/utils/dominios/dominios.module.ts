import { Module } from '@nestjs/common';
import { ServicesModule } from 'src/shared/services/services.module';
import { DominiosService } from './dominios.service';

@Module({
  imports: [ServicesModule],
  providers: [DominiosService],
  exports: [DominiosService],
})
export class DominiosModule {}
