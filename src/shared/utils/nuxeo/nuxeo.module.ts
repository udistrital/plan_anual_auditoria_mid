import { Module } from "@nestjs/common";
import { NuxeoService } from "src/shared/utils/nuxeo/nuxeo.service";
import { GestorDocumentalService } from "../../services/gestor-documental/gestor-documental.service";

@Module({
  providers: [NuxeoService, GestorDocumentalService],
  exports: [NuxeoService, GestorDocumentalService]
})
export class NuxeoModule {};
