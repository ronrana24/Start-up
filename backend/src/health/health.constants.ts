export enum HealthModuleId {
  prisma = 'prisma',
  auth = 'auth',
  users = 'users',
  products = 'products',
  inventory = 'inventory',
  orders = 'orders',
  admin = 'admin',
  riders = 'riders',
}

export const HEALTH_MODULE_VALUES = Object.values(
  HealthModuleId,
) as HealthModuleId[];
