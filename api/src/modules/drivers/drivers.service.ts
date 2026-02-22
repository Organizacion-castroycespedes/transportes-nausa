import * as bcrypt from "bcryptjs";
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DatabaseService } from "../../common/db/database.service";
import type {
  CreateDriverDto,
  DriverResponseDto,
  UpdateDriverDto,
  UpdateDriverStatusDto,
} from "./dto/driver.dto";

type ActorContext = {
  userId?: string;
  tenantId?: string;
  roles: string[];
};

type DriverRecord = {
  id: string;
  tenant_id: string;
  user_id: string;
  user_email: string;
  user_estado: string;
  licencia_numero: string | null;
  licencia_categoria: string | null;
  licencia_vencimiento: string | null;
  telefono: string | null;
  direccion: string | null;
  estado: string;
  persona_id: string | null;
  nombres: string | null;
  apellidos: string | null;
  documento_tipo: string | null;
  documento_numero: string | null;
  telefono_persona: string | null;
  direccion_persona: string | null;
  email_personal: string | null;
};

@Injectable()
export class DriversService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  private resolveTenant(actor: ActorContext) {
    if (!actor.tenantId) {
      throw new ForbiddenException("Tenant requerido");
    }
    return actor.tenantId;
  }

  private mapRecord(record: DriverRecord): DriverResponseDto {
    return {
      id: record.id,
      tenantId: record.tenant_id,
      userId: record.user_id,
      userEmail: record.user_email,
      userEstado: record.user_estado,
      licenciaNumero: record.licencia_numero,
      licenciaCategoria: record.licencia_categoria,
      licenciaVencimiento: record.licencia_vencimiento,
      telefono: record.telefono,
      direccion: record.direccion,
      estado: record.estado,
      persona: {
        id: record.persona_id,
        nombres: record.nombres,
        apellidos: record.apellidos,
        documentoTipo: record.documento_tipo,
        documentoNumero: record.documento_numero,
        telefono: record.telefono_persona,
        direccion: record.direccion_persona,
        emailPersonal: record.email_personal,
      },
    };
  }

  private baseQuery() {
    return `
      SELECT
        c.id,
        c.tenant_id,
        c.user_id,
        u.email AS user_email,
        u.estado AS user_estado,
        c.licencia_numero,
        c.licencia_categoria,
        c.licencia_vencimiento::text,
        c.telefono,
        c.direccion,
        c.estado,
        p.id AS persona_id,
        p.nombres,
        p.apellidos,
        p.documento_tipo,
        p.documento_numero,
        p.telefono AS telefono_persona,
        p.direccion AS direccion_persona,
        p.email_personal
      FROM conductores c
      INNER JOIN users u ON u.id = c.user_id
      LEFT JOIN personas p ON p.id = u.persona_id
    `;
  }

  async list(actor: ActorContext) {
    const tenantId = this.resolveTenant(actor);
    const result = await this.db.query(
      `${this.baseQuery()} WHERE c.tenant_id = $1 ORDER BY p.nombres NULLS LAST, p.apellidos NULLS LAST`,
      [tenantId]
    );
    return (result.rows as DriverRecord[]).map((row: DriverRecord) => this.mapRecord(row));
  }

  async getById(id: string, actor: ActorContext) {
    const tenantId = this.resolveTenant(actor);
    const result = await this.db.query(
      `${this.baseQuery()} WHERE c.id = $1 AND c.tenant_id = $2 LIMIT 1`,
      [id, tenantId]
    );
    const record = (result.rows as DriverRecord[])[0];
    if (!record) {
      throw new NotFoundException("Conductor no encontrado");
    }
    return this.mapRecord(record);
  }

  async getMe(actor: ActorContext) {
    if (!actor.userId) {
      throw new ForbiddenException("Usuario requerido");
    }
    const tenantId = this.resolveTenant(actor);
    const result = await this.db.query(
      `${this.baseQuery()} WHERE c.user_id = $1 AND c.tenant_id = $2 LIMIT 1`,
      [actor.userId, tenantId]
    );
    const record = (result.rows as DriverRecord[])[0];
    if (!record) {
      throw new NotFoundException("Perfil de conductor no encontrado");
    }
    return this.mapRecord(record);
  }

  async create(payload: CreateDriverDto, actor: ActorContext) {
    const tenantId = this.resolveTenant(actor);
    if (!payload.password || payload.password.length < 8) {
      throw new BadRequestException("Password debe tener mínimo 8 caracteres");
    }
    const email = payload.email.trim().toLowerCase();
    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");

      const duplicate = await client.query(
        `SELECT id FROM users WHERE tenant_id = $1 AND lower(email) = $2`,
        [tenantId, email]
      );
      if (duplicate.rows[0]) {
        throw new BadRequestException("Email ya registrado");
      }

      const role = await client.query<{ id: string }>(
        `SELECT id FROM roles WHERE upper(nombre) = 'USER' LIMIT 1`
      );
      if (!role.rows[0]) {
        throw new BadRequestException("Rol USER no existe");
      }

      const personaInsert = await client.query<{ id: string }>(
        `
          INSERT INTO personas (
            tenant_id, nombres, apellidos, documento_tipo, documento_numero,
            telefono, direccion, email_personal, cargo_nombre
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Conductor')
          RETURNING id
        `,
        [
          tenantId,
          payload.persona.nombres,
          payload.persona.apellidos,
          payload.persona.documentoTipo,
          payload.persona.documentoNumero,
          payload.persona.telefono ?? null,
          payload.persona.direccion ?? null,
          payload.persona.emailPersonal ?? null,
        ]
      );

      const passwordHash = await bcrypt.hash(payload.password, 12);
      const userInsert = await client.query<{ id: string }>(
        `
          INSERT INTO users (tenant_id, persona_id, email, password_hash, estado)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `,
        [
          tenantId,
          personaInsert.rows[0].id,
          email,
          passwordHash,
          payload.estado ?? "ACTIVE",
        ]
      );

      await client.query(
        `INSERT INTO user_roles (user_id, role_id, tenant_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [userInsert.rows[0].id, role.rows[0].id, tenantId]
      );

      const driverInsert = await client.query<{ id: string }>(
        `
          INSERT INTO conductores (
            tenant_id, user_id, licencia_numero, licencia_categoria,
            licencia_vencimiento, telefono, direccion, estado
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,'A')
          RETURNING id
        `,
        [
          tenantId,
          userInsert.rows[0].id,
          payload.licenciaNumero ?? null,
          payload.licenciaCategoria ?? null,
          payload.licenciaVencimiento ?? null,
          payload.telefono ?? null,
          payload.direccion ?? null,
        ]
      );

      await client.query("COMMIT");
      return this.getById(driverInsert.rows[0].id, actor);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async updateById(id: string, payload: UpdateDriverDto, actor: ActorContext) {
    const tenantId = this.resolveTenant(actor);
    const current = await this.getById(id, actor);
    await this.db.query(
      `
      UPDATE conductores
      SET
        licencia_numero = COALESCE($1, licencia_numero),
        licencia_categoria = COALESCE($2, licencia_categoria),
        licencia_vencimiento = COALESCE($3::date, licencia_vencimiento),
        telefono = COALESCE($4, telefono),
        direccion = COALESCE($5, direccion),
        updated_at = now()
      WHERE id = $6 AND tenant_id = $7
      `,
      [
        payload.licenciaNumero ?? null,
        payload.licenciaCategoria ?? null,
        payload.licenciaVencimiento ?? null,
        payload.telefono ?? null,
        payload.direccion ?? null,
        id,
        tenantId,
      ]
    );

    if (payload.email) {
      await this.db.query(
        `UPDATE users SET email = $1 WHERE id = $2 AND tenant_id = $3`,
        [payload.email.trim().toLowerCase(), current.userId, tenantId]
      );
    }

    if (payload.persona) {
      await this.db.query(
        `
          UPDATE personas
          SET
            nombres = COALESCE($1, nombres),
            apellidos = COALESCE($2, apellidos),
            documento_tipo = COALESCE($3, documento_tipo),
            documento_numero = COALESCE($4, documento_numero),
            telefono = COALESCE($5, telefono),
            direccion = COALESCE($6, direccion),
            email_personal = COALESCE($7, email_personal)
          WHERE id = $8 AND tenant_id = $9
        `,
        [
          payload.persona.nombres ?? null,
          payload.persona.apellidos ?? null,
          payload.persona.documentoTipo ?? null,
          payload.persona.documentoNumero ?? null,
          payload.persona.telefono ?? null,
          payload.persona.direccion ?? null,
          payload.persona.emailPersonal ?? null,
          current.persona.id,
          tenantId,
        ]
      );
    }

    return this.getById(id, actor);
  }

  async updateStatus(id: string, payload: UpdateDriverStatusDto, actor: ActorContext) {
    const tenantId = this.resolveTenant(actor);
    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const updateDriver = await client.query<{ user_id: string }>(
        `
          UPDATE conductores
          SET estado = $1, updated_at = now()
          WHERE id = $2 AND tenant_id = $3
          RETURNING user_id
        `,
        [payload.estado, id, tenantId]
      );

      const driver = updateDriver.rows[0];
      if (!driver) {
        throw new NotFoundException("Conductor no encontrado");
      }

      if (payload.estado === "I") {
        await client.query(
          `
            UPDATE users
            SET estado = 'INACTIVE'
            WHERE id = $1 AND tenant_id = $2
          `,
          [driver.user_id, tenantId]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return this.getById(id, actor);
  }

  async updateMe(payload: UpdateDriverDto, actor: ActorContext) {
    const current = await this.getMe(actor);
    return this.updateById(current.id, payload, actor);
  }
}
