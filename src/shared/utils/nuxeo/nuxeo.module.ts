import { Module } from "@nestjs/common";
import { NuxeoService } from "src/shared/utils/nuxeo/nuxeo.service";
import { GestorDocumentalModule } from "src/shared/services/gestor-documental/gestor-documental.module";

@Module({
  imports: [GestorDocumentalModule],
  providers: [NuxeoService],
  exports: [NuxeoService]
})
export class NuxeoModule {};
