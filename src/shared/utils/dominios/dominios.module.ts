import { Module } from "@nestjs/common";
import { OikosModule } from "src/shared/services/oikos/oikos.module";
import { ParametrosModule } from "src/shared/services/parametros/parametros.module";
import { DominiosService } from "./dominios.service";

@Module({
  imports: [OikosModule, ParametrosModule],
  providers: [DominiosService],
  exports: [DominiosService],
})
export class DominiosModule {};
