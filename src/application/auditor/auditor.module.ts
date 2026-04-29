import { Module } from '@nestjs/common';
import { AuditorController } from './auditor.controller';
import { AuditorService } from './auditor.service';
import { ServicesModule } from 'src/shared/services/services.module';

@Module({
  imports: [ServicesModule],
  controllers: [AuditorController],
  providers: [AuditorService],
  exports: [AuditorService],
})
export class AuditorModule {}
