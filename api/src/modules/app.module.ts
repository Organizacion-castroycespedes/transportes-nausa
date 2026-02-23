import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { TenantsModule } from "./tenants/tenants.module";
import { PermissionsModule } from "./permissions/permissions.module";
import { BranchesModule } from "./branches/branches.module";
import { LocationsModule } from "./locations/locations.module";
import { RolesModule } from "./roles/roles.module";
import { MenuModule } from "./menu/menu.module";
import { DriversModule } from "./drivers/drivers.module";
import { InspeccionesModule } from "./inspecciones/inspecciones.module";
import { ReportsModule } from "./reports/reports.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    TenantsModule,
    PermissionsModule,
    BranchesModule,
    LocationsModule,
    RolesModule,
    MenuModule,
    DriversModule,
    InspeccionesModule,
    ReportsModule,
  ],
})
export class AppModule {}
