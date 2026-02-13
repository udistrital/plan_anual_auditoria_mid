import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { InformeController } from './informe.controller';
import { InformeService } from './informe.service';

@Module({
  imports: [HttpModule],
  controllers: [InformeController],
  providers: [InformeService],
  exports: [InformeService],
})
export class InformeModule {}