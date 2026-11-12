import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

export interface NewBookingPrefill {
  staffId?: string;
  day?: string;
  time?: string;
  guestId?: string;
}

interface UiState {
  newBooking: NewBookingPrefill | null;
  openNewBooking: (prefill?: NewBookingPrefill) => void;
  closeNewBooking: () => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
}

const UiContext = createContext<UiState | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [newBooking, setNewBooking] = useState<NewBookingPrefill | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const value = useMemo<UiState>(
    () => ({
      newBooking,
      openNewBooking: (prefill = {}) => setNewBooking(prefill),
      closeNewBooking: () => setNewBooking(null),
      paletteOpen,
      setPaletteOpen,
    }),
    [newBooking, paletteOpen],
  );
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): UiState {
  const v = useContext(UiContext);
  if (!v) throw new Error('useUi outside UiProvider');
  return v;
}

/** The booking drawer is driven by ?booking=<id> so it can be linked and survives refresh. */
export function useBookingDrawer() {
  const [params, setParams] = useSearchParams();
  const id = params.get('booking');
  const open = useCallback(
    (bookingId: string) => {
      const next = new URLSearchParams(params);
      next.set('booking', bookingId);
      setParams(next);
    },
    [params, setParams],
  );
  const close = useCallback(() => {
    const next = new URLSearchParams(params);
    next.delete('booking');
    setParams(next);
  }, [params, setParams]);
  return { id, open, close };
}
