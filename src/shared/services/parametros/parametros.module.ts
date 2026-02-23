import { Module } from "@nestjs/common";
import { ParametrosService } from "./parametros.service";
import { HttpModule } from "@nestjs/axios";

@Module({
  imports: [HttpModule],
  providers: [ParametrosService],
  exports: [ParametrosService]
})
export class ParametrosModule {};
