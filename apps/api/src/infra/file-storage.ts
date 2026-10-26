import type { Readable } from 'node:stream';

/**
 * Where photos and generated files live (ADR-0007). Keys are relative paths such as
 * `photos/2026/10/<photoId>/original.jpg`. Today only the local disk; an S3-compatible
 * self-hosted store (MinIO, Garage) can be added as another implementation.
 */
export interface FileStorage {
  put(key: string, data: Buffer | Readable): Promise<{ size: number }>;
  get(key: string): Promise<Readable>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
}
