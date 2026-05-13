import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { HEALTH_MODULE_VALUES, HealthModuleId } from './health.constants';
import { isSecureSecretConfigured } from '../config/configuration';

export type ModuleHealthStatus = 'up' | 'down';

export interface ModuleHealthResult {
  module: HealthModuleId;
  status: ModuleHealthStatus;
  error?: string;
}

export interface AggregateHealthResult {
  status: 'ok' | 'error';
  modules: Record<HealthModuleId, Omit<ModuleHealthResult, 'module'>>;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async checkModule(id: HealthModuleId): Promise<ModuleHealthResult> {
    if (id === HealthModuleId.auth) {
      return this.checkAuth();
    }
    const db = await this.checkDatabase();
    if (!db.ok) {
      return {
        module: id,
        status: 'down',
        error: db.error,
      };
    }
    return { module: id, status: 'up' };
  }

  async checkAll(): Promise<AggregateHealthResult> {
    const db = await this.checkDatabase();
    const jwtSecret = this.config.get<string>('jwt.secret');
    const jwtOk = isSecureSecretConfigured(jwtSecret);
    const authOk = db.ok && jwtOk;

    const modules = {} as Record<
      HealthModuleId,
      Omit<ModuleHealthResult, 'module'>
    >;

    for (const key of HEALTH_MODULE_VALUES) {
      if (key === HealthModuleId.auth) {
        modules[HealthModuleId.auth] = {
          status: authOk ? 'up' : 'down',
          ...(!authOk
            ? {
                error: !db.ok ? db.error : 'JWT secret is not configured',
              }
            : {}),
        };
        continue;
      }
      modules[key] = {
        status: db.ok ? 'up' : 'down',
        ...(db.ok ? {} : { error: db.error }),
      };
    }

    const allUp = (
      Object.values(modules) as Array<{ status: ModuleHealthStatus }>
    ).every((m) => m.status === 'up');

    return {
      status: allUp ? 'ok' : 'error',
      modules,
    };
  }

  private async checkAuth(): Promise<ModuleHealthResult> {
    const db = await this.checkDatabase();
    const jwtSecret = this.config.get<string>('jwt.secret');
    const jwtOk = isSecureSecretConfigured(jwtSecret);
    const ok = db.ok && jwtOk;
    return {
      module: HealthModuleId.auth,
      status: ok ? 'up' : 'down',
      ...(!ok
        ? {
            error: !db.ok ? db.error : 'JWT secret is not configured',
          }
        : {}),
    };
  }

  private async checkDatabase(): Promise<
    { ok: true } | { ok: false; error: string }
  > {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true };
    } catch (e) {
      if (e instanceof Error) {
        this.logger.error('Database connectivity check failed', e.stack);
      } else {
        this.logger.error('Database connectivity check failed', String(e));
      }
      return { ok: false, error: 'Database connectivity check failed' };
    }
  }
}
