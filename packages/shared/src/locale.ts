import { z } from 'zod';

/** Czech default messages for all Zod validations (call once at app start). */
export function useCzechValidationMessages(): void {
  z.config(z.locales.cs());
}
