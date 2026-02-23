import { Module } from "@nestjs/common";
import { OikosService } from "./oikos.service";
import { HttpModule } from "@nestjs/axios";

@Module({
  imports: [HttpModule],
  providers: [OikosService],
  exports: [OikosService]
})
export class OikosModule {};
