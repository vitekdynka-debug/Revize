/**
 * Authorization works with permissions; roles are only named bundles of them (ADR-0010).
 * Adding a role = adding an entry to ROLE_PERMISSIONS.
 */
export const PERMISSIONS = [
  'user.manage',
  'audit.read',
  'customer.read',
  'customer.write',
  /** Add a location (also technicians in the field); changing the tree needs customer.write. */
  'location.create',
  'equipmentType.read',
  'equipmentType.write',
  'item.read',
  'item.write',
  'item.import',
  'inspection.read',
  'inspection.perform',
  'inspection.close',
  'inspection.reopen',
  /** Delete a whole inspection with its results and photos (test inspections; administrators). */
  'inspection.delete',
  'export.read',
  'settings.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = ['admin', 'inspector'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrátor',
  inspector: 'Technik',
};

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: PERMISSIONS,
  inspector: [
    'customer.read',
    'location.create',
    'equipmentType.read',
    'item.read',
    'item.write',
    /** Technicians import the customer's records before the visit. */
    'item.import',
    'inspection.read',
    'inspection.perform',
    'export.read',
  ],
};

/**
 * What an administrator can give a technician on top of the role (`app_user.extra_permissions`,
 * ADR-0022), grouped as the user form shows it. A group grants all of its permissions.
 */
export const PERMISSION_GROUPS: {
  key: string;
  label: string;
  description: string;
  permissions: readonly Permission[];
}[] = [
  {
    key: 'customers',
    label: 'Zákazníci a provozovny',
    description: 'Zakládat a upravovat zákazníky, provozovny a strom umístění',
    permissions: ['customer.read', 'customer.write'],
  },
  {
    key: 'equipmentTypes',
    label: 'Typy vybavení',
    description: 'Pole, texty protokolu, kontrolní body, slučování typů',
    permissions: ['equipmentType.read', 'equipmentType.write'],
  },
  {
    key: 'closeInspections',
    label: 'Uzavírání kontrol',
    description: 'Uzavřít a znovu otevřít kontrolu (data příští kontroly)',
    permissions: ['inspection.close', 'inspection.reopen'],
  },
  {
    key: 'deleteInspections',
    label: 'Mazání kontrol',
    description: 'Smazat kontrolu i s výsledky a fotkami',
    permissions: ['inspection.delete'],
  },
  {
    key: 'settings',
    label: 'Nastavení firmy',
    description: 'Údaje firmy, logo, hlavička a patička protokolu',
    permissions: ['settings.manage'],
  },
  {
    key: 'audit',
    label: 'Historie změn',
    description: 'Prohlížet, kdo co kdy změnil',
    permissions: ['audit.read'],
  },
  {
    key: 'users',
    label: 'Uživatelé',
    description: 'Zakládat uživatele, měnit role a oprávnění (jako administrátor)',
    permissions: ['user.manage'],
  },
];

/** Permissions of a role plus those given to the user on top of it. */
export function permissionsOf(role: Role, extra: readonly string[] = []): ReadonlySet<Permission> {
  const all = new Set<Permission>(ROLE_PERMISSIONS[role]);
  for (const permission of extra) {
    if ((PERMISSIONS as readonly string[]).includes(permission)) all.add(permission as Permission);
  }
  return all;
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
