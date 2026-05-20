import { Module } from '@nestjs/common';
import { PlanMejoramientoAuditorController } from './plan-mejoramiento-auditor.controller';
import { PlanMejoramientoAuditorService } from './plan-mejoramiento-auditor.service';
import { ServicesModule } from 'src/shared/services/services.module';

@Module({
  imports: [ServicesModule],
  controllers: [PlanMejoramientoAuditorController],
  providers: [PlanMejoramientoAuditorService],
})
export class PlanMejoramientoAuditorModule {}
