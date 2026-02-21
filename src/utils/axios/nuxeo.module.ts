import { Module } from "@nestjs/common";
import { NuxeoService } from "./nuxeo.service";
import { GestorDocumentalService } from "./gestor-documental.service";

@Module({
  providers: [NuxeoService, GestorDocumentalService],
  exports: [NuxeoService, GestorDocumentalService]
})
export class NuxeoModule {};
