import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../common/db/database.module";
import { AccessControlModule } from "../../common/access-control.module";
import { DriversController } from "./drivers.controller";
import { DriversService } from "./drivers.service";

@Module({
  imports: [DatabaseModule, AccessControlModule],
  controllers: [DriversController],
  providers: [DriversService],
  exports: [DriversService],
})
export class DriversModule {}
