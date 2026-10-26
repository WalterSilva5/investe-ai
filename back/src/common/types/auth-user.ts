import { Role } from '@prisma/client';

export interface AuthUser {
  userId: string;
  email: string;
  tenantId?: string;
  role?: Role;
}
