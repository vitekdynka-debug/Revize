import { z } from 'zod';
import { PERMISSIONS, ROLES } from '../permissions.js';
import { idSchema } from './common.js';

export const PASSWORD_MIN_LENGTH = 10;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Heslo musí mít aspoň ${PASSWORD_MIN_LENGTH} znaků`)
  .max(200);

/** Trimmed and lower-cased first: iPad keyboards like to capitalize the first letter. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(200)
  .pipe(z.email('Neplatný e-mail'));

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
  /** Shown in the list of active sessions, e.g. "iPad terén". */
  deviceLabel: z.string().max(100).optional(),
});
export type LoginRequest = z.input<typeof loginRequestSchema>;

export const currentUserSchema = z.object({
  id: idSchema,
  email: z.string(),
  displayName: z.string(),
  role: z.enum(ROLES),
  organizationId: idSchema,
  permissions: z.array(z.enum(PERMISSIONS)),
});
export type CurrentUser = z.infer<typeof currentUserSchema>;

export const loginResponseSchema = z.object({
  user: currentUserSchema,
  /** Same token as the cookie; native clients (Capacitor) send it as `Authorization: Bearer`. */
  token: z.string(),
  expiresAt: z.string(),
});

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: passwordSchema,
});
