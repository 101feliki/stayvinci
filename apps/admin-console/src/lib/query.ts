import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/** Mutation that refreshes all data afterwards and reports the outcome with a toast. */
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
