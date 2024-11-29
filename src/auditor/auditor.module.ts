import { Module } from '@nestjs/common';
import { AuditorController } from './auditor.controller';
import { AuditorService } from './auditor.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  controllers: [AuditorController],
  providers: [AuditorService]
})
export class AuditorModule {}
