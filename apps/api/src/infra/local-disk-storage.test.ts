import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { text } from 'node:stream/consumers';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalDiskStorage } from './local-disk-storage.js';

describe('LocalDiskStorage', () => {
  let root: string;
  let storage: LocalDiskStorage;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'revize-storage-'));
    storage = new LocalDiskStorage(root);
  });
  afterEach(() => rm(root, { recursive: true, force: true }));

  it('stores, reads and deletes files by key', async () => {
    const { size } = await storage.put('photos/2026/10/a/original.jpg', Buffer.from('jpeg-data'));
    expect(size).toBe(9);
    expect(await storage.exists('photos/2026/10/a/original.jpg')).toBe(true);
    expect(await text(await storage.get('photos/2026/10/a/original.jpg'))).toBe('jpeg-data');
    await storage.delete('photos/2026/10/a/original.jpg');
    expect(await storage.exists('photos/2026/10/a/original.jpg')).toBe(false);
  });

  it('accepts streams and leaves no temp files behind', async () => {
    await storage.put('x/stream.bin', Readable.from(['a', 'b', 'c']));
    expect(await readdir(join(root, 'x'))).toEqual(['stream.bin']);
  });

  it('rejects keys escaping the root', async () => {
    await expect(storage.put('../evil', Buffer.from(''))).rejects.toThrow('Invalid key');
    await expect(storage.put('/etc/passwd', Buffer.from(''))).rejects.toThrow('Invalid key');
    await expect(storage.get('a/../../b')).rejects.toThrow('Invalid key');
  });
});
