import type {
  CurrentUser,
  Customer,
  EquipmentType,
  Item,
  ItemStatus,
  Location,
  Site,
  User,
  createCustomerSchema,
  createEquipmentTypeSchema,
  createItemSchema,
  createLocationSchema,
  createLocationSeriesSchema,
  createSiteSchema,
  createUserRequestSchema,
  bulkUpdateItemsSchema,
  equipmentTypePresetSchema,
  listItemsQuerySchema,
  updateCustomerSchema,
  updateEquipmentTypeSchema,
  updateItemSchema,
  updateLocationSchema,
  updateSiteSchema,
  updateUserRequestSchema,
} from '@revize/shared';
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { z } from 'zod';
import { ApiRequestError, api, queryString } from './client.js';

type In<T extends z.ZodType> = z.input<T>;

/**
 * Mutation that refreshes the given queries afterwards. The refresh runs in the background, so
 * forms close and confirm right after the save instead of waiting for every list to reload.
 */
function useApiMutation<TVars, TResult>(
  fn: (vars: TVars) => Promise<TResult>,
  invalidate: QueryKey[],
) {
  const client = useQueryClient();
  return useMutation<TResult, ApiRequestError, TVars>({
    mutationFn: fn,
    onSuccess: () => {
      for (const queryKey of invalidate) void client.invalidateQueries({ queryKey });
    },
  });
}

// ---------- auth ----------

export function useMe() {
  return useQuery<CurrentUser | null, ApiRequestError>({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api.get<CurrentUser>('/auth/me');
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 60_000,
  });
}

export function useLogin() {
  const client = useQueryClient();
  return useMutation<{ user: CurrentUser }, ApiRequestError, { email: string; password: string }>({
    mutationFn: (body) => api.post('/auth/login', { ...body, deviceLabel: 'Kancelář (prohlížeč)' }),
    onSuccess: (data) => client.setQueryData(['me'], data.user),
  });
}

export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>('/auth/logout'),
    onSettled: () => {
      client.setQueryData(['me'], null);
      client.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
    },
  });
}

export function useChangePassword() {
  return useApiMutation(
    (body: { currentPassword: string; newPassword: string }) =>
      api.post<void>('/auth/password', body),
    [],
  );
}

// ---------- users ----------

export const useUsers = () =>
  useQuery<User[], ApiRequestError>({ queryKey: ['users'], queryFn: () => api.get('/users') });
export const useCreateUser = () =>
  useApiMutation(
    (body: In<typeof createUserRequestSchema>) => api.post<User>('/users', body),
    [['users']],
  );
export const useUpdateUser = () =>
  useApiMutation(
    ({ id, ...body }: In<typeof updateUserRequestSchema> & { id: string }) =>
      api.patch<User>(`/users/${id}`, body),
    [['users']],
  );

// ---------- customers & sites ----------

export const useCustomers = (includeArchived = false) =>
  useQuery<Customer[], ApiRequestError>({
    queryKey: ['customers', { includeArchived }],
    queryFn: () => api.get(`/customers${queryString({ includeArchived })}`),
  });
export const useCustomer = (id: string) =>
  useQuery<Customer, ApiRequestError>({
    queryKey: ['customers', id],
    queryFn: () => api.get(`/customers/${id}`),
  });
export const useCreateCustomer = () =>
  useApiMutation(
    (body: In<typeof createCustomerSchema>) => api.post<Customer>('/customers', body),
    [['customers']],
  );
export const useUpdateCustomer = () =>
  useApiMutation(
    ({ id, ...body }: In<typeof updateCustomerSchema> & { id: string }) =>
      api.patch<Customer>(`/customers/${id}`, body),
    [['customers']],
  );

export const useSites = (customerId: string | null | undefined, includeArchived = false) =>
  useQuery<Site[], ApiRequestError>({
    queryKey: ['sites', customerId, { includeArchived }],
    queryFn: () => api.get(`/customers/${customerId}/sites${queryString({ includeArchived })}`),
    enabled: !!customerId,
  });
export const useSite = (id: string) =>
  useQuery<Site, ApiRequestError>({
    queryKey: ['site', id],
    queryFn: () => api.get(`/sites/${id}`),
  });
export const useCreateSite = () =>
  useApiMutation(
    ({ customerId, ...body }: In<typeof createSiteSchema> & { customerId: string }) =>
      api.post<Site>(`/customers/${customerId}/sites`, body),
    [['sites'], ['customers']],
  );
export const useUpdateSite = () =>
  useApiMutation(
    ({ id, ...body }: In<typeof updateSiteSchema> & { id: string }) =>
      api.patch<Site>(`/sites/${id}`, body),
    [['sites'], ['site'], ['customers']],
  );

// ---------- locations ----------

export const useLocations = (siteId: string | null | undefined) =>
  useQuery<Location[], ApiRequestError>({
    queryKey: ['locations', siteId],
    queryFn: () => api.get(`/sites/${siteId}/locations`),
    enabled: !!siteId,
  });
export const useCreateLocation = () =>
  useApiMutation(
    ({ siteId, ...body }: In<typeof createLocationSchema> & { siteId: string }) =>
      api.post<Location>(`/sites/${siteId}/locations`, body),
    [['locations']],
  );
export const useCreateLocationSeries = () =>
  useApiMutation(
    ({ siteId, ...body }: In<typeof createLocationSeriesSchema> & { siteId: string }) =>
      api.post<Location[]>(`/sites/${siteId}/locations/series`, body),
    [['locations']],
  );
export const useUpdateLocation = () =>
  useApiMutation(
    ({ id, ...body }: In<typeof updateLocationSchema> & { id: string }) =>
      api.patch<Location>(`/locations/${id}`, body),
    [['locations'], ['items']],
  );

// ---------- equipment types ----------

export const useEquipmentTypes = (includeArchived = false) =>
  useQuery<EquipmentType[], ApiRequestError>({
    queryKey: ['equipment-types', { includeArchived }],
    queryFn: () => api.get(`/equipment-types${queryString({ includeArchived })}`),
  });
export const useEquipmentType = (id: string) =>
  useQuery<EquipmentType, ApiRequestError>({
    queryKey: ['equipment-types', id],
    queryFn: () => api.get(`/equipment-types/${id}`),
  });
export const useEquipmentTypePresets = () =>
  useQuery<z.infer<typeof equipmentTypePresetSchema>[], ApiRequestError>({
    queryKey: ['equipment-type-presets'],
    queryFn: () => api.get('/equipment-type-presets'),
    staleTime: Infinity,
  });
export const useCreateEquipmentType = () =>
  useApiMutation(
    (body: In<typeof createEquipmentTypeSchema>) =>
      api.post<EquipmentType>('/equipment-types', body),
    [['equipment-types']],
  );
export const useUpdateEquipmentType = () =>
  useApiMutation(
    ({ id, ...body }: In<typeof updateEquipmentTypeSchema> & { id: string }) =>
      api.patch<EquipmentType>(`/equipment-types/${id}`, body),
    [['equipment-types'], ['items']],
  );

// ---------- items ----------

export type ItemQuery = {
  customerId?: string;
  siteId?: string;
  equipmentTypeId?: string;
  locationId?: string;
  status?: ItemStatus;
  q?: string;
  includeRetired?: boolean;
  sort?: z.output<typeof listItemsQuerySchema>['sort'];
  limit?: number;
  offset?: number;
};

export const useItems = (query: ItemQuery, enabled = true) =>
  useQuery<{ items: Item[]; total: number }, ApiRequestError>({
    queryKey: ['items', query],
    queryFn: () => api.get(`/items${queryString(query)}`),
    enabled,
    placeholderData: (previous) => previous,
  });
export const useCreateItem = () =>
  useApiMutation(
    (body: In<typeof createItemSchema>) => api.post<Item>('/items', body),
    [['items'], ['customers'], ['sites'], ['locations'], ['equipment-types']],
  );
export const useUpdateItem = () =>
  useApiMutation(
    ({ id, ...body }: In<typeof updateItemSchema> & { id: string }) =>
      api.patch<Item>(`/items/${id}`, body),
    [['items'], ['locations']],
  );
export const useBulkUpdateItems = () =>
  useApiMutation(
    (body: In<typeof bulkUpdateItemsSchema>) =>
      api.post<{ updated: number }>('/items/bulk-update', body),
    [['items'], ['locations']],
  );
