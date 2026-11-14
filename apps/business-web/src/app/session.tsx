import { createContext, useContext, type ReactNode } from 'react';
import type { SessionInfo } from '../lib/api';
import type { Capability } from '../mock/types';

export type SignedInSession = Extract<SessionInfo, { signedIn: true }>;

const SessionContext = createContext<SignedInSession | null>(null);

export function SessionProvider({
  value,
  children,
}: {
  value: SignedInSession;
  children: ReactNode;
}) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SignedInSession {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useSession must be used inside a signed-in session');
  return s;
}

/** UI-side capability check. The API enforces the same rule; this only hides controls. */
export function useCan(): (cap: Capability) => boolean {
  const s = useSession();
  return (cap) => s.capabilities.includes(cap);
}
