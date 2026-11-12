import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useSession } from '../app/session';

/** Query scoped to the current tenant: switching House refetches everything. */
export function useTenantQuery<T>(
  key: readonly unknown[],
  fn: () => Promise<T>,
  opts: { enabled?: boolean } = {},
) {
  const { tenant } = useSession();
  return useQuery({ queryKey: [tenant.id, ...key], queryFn: fn, enabled: opts.enabled ?? true });
}

/**
 * Mutation that refreshes data afterwards and reports the outcome with a toast.
 * Errors from the API (permission, conflict, validation) are shown verbatim.
 */
export function useAction<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  opts: { success?: string | ((r: TResult) => string); onSuccess?: (r: TResult) => void } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (result) => {
      await qc.invalidateQueries();
      if (opts.success)
        toast.success(typeof opts.success === 'function' ? opts.success(result) : opts.success);
      opts.onSuccess?.(result);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    },
  });
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
