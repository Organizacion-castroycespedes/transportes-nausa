import { Module } from "@nestjs/common";
import { AccessControlModule } from "../../common/access-control.module";
import { DatabaseModule } from "../../common/db/database.module";
import { InspeccionesController } from "./inspecciones.controller";
import { InspeccionesService } from "./inspecciones.service";

@Module({
  imports: [DatabaseModule, AccessControlModule],
  controllers: [InspeccionesController],
  providers: [InspeccionesService],
  exports: [InspeccionesService],
})
export class InspeccionesModule {}
