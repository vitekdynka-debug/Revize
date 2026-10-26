import { describe, expect, it } from 'vitest';
import { PERMISSIONS, hasPermission, permissionsOf } from './permissions.js';

describe('permissions', () => {
  it('gives admins everything', () => {
    expect([...permissionsOf('admin')].sort()).toEqual([...PERMISSIONS].sort());
  });

  it('lets inspectors work in the field but not administer', () => {
    expect(hasPermission('inspector', 'inspection.perform')).toBe(true);
    expect(hasPermission('inspector', 'item.write')).toBe(true);
    expect(hasPermission('inspector', 'user.manage')).toBe(false);
    expect(hasPermission('inspector', 'inspection.reopen')).toBe(false);
  });
});
