import { Module } from "@nestjs/common";
import { GestorDocumentalService } from "../../services/gestor-documental/gestor-documental.service";
import { HttpModule } from "@nestjs/axios";

@Module({
  imports: [HttpModule],
  providers: [GestorDocumentalService],
  exports: [GestorDocumentalService]
})
export class GestorDocumentalModule {};
