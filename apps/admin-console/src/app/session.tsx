import { createContext, useContext, type ReactNode } from 'react';
import type { PlatformCapability } from '@stayvinci/demo-data/platform';
import type { SessionInfo } from '../mock/api';

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

/** UI-side role check. The API enforces the same rule; this only hides controls. */
export function useCan(): (cap: PlatformCapability) => boolean {
  const s = useSession();
  return (cap) => s.capabilities.includes(cap);
}
