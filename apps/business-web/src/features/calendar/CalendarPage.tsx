import { useMemo, useState, type DragEvent } from 'react';
import { ChevronLeft, ChevronRight, Lock, Plus } from 'lucide-react';
import {
  Avatar,
  Button,
  Card,
  Dialog,
  Field,
  Input,
  PageHeader,
  Segmented,
  Select,
  cn,
} from '@stayvinci/ui';
import { api, todayKey } from '../../lib/api';
import type { Booking, CalendarBlock, Resource } from '../../mock/types';
import { useCan, useSession } from '../../app/session';
import { useBookingDrawer, useUi } from '../../app/ui';
import { ErrorState, PageSkeleton } from '../../components/common';
import {
  addDaysKey,
  dayKey,
  dayLabel,
  guestName,
  time,
  zonedParts,
  zonedToUtc,
} from '../../lib/format';
import { BOOKING_STATE } from '../../lib/states';
import { useAction, useTenantQuery } from '../../lib/query';

const START_H = 8;
const END_H = 21;
const HOUR_PX = 64;

export function CalendarPage() {
  const { tenant } = useSession();
  return tenant.vertical === 'short_stay' ? <NightGrid /> : <SlotCalendar />;
}

/* =================== Slot mode (spa): day + week =================== */

function SlotCalendar() {
  const { tenant } = useSession();
  const tz = tenant.timezone;
  const can = useCan();
  const [day, setDay] = useState(todayKey(tz));
  const [view, setView] = useState<'day' | 'week'>('day');
  const [blockOpen, setBlockOpen] = useState(false);
  const bookings = useTenantQuery(['bookings'], api.bookings.list);
  const blocks = useTenantQuery(['blocks'], api.blocks);
  const team = useTenantQuery(['team'], api.team.list);
  const guests = useTenantQuery(['guests'], api.guests.list, { enabled: can('guest.view') });
  const catalogue = useTenantQuery(['catalogue'], api.catalogue.get);

  if (bookings.error) return <ErrorState error={bookings.error} />;
  if (!bookings.data || !team.data) return <PageSkeleton />;

  const staff = team.data.resources.filter((r) => r.type === 'staff');
  const guestMap = new Map((guests.data ?? []).map((g) => [g.id, g]));
  const svcMap = new Map((catalogue.data?.services ?? []).map((s) => [s.id, s]));
  const step = view === 'day' ? 1 : 7;

  return (
    <div>
      <PageHeader
        title="Calendar"
        description={
          view === 'day'
            ? 'Drag a booking to move it. Click an empty slot to book.'
            : 'The week at a glance.'
        }
        actions={
          <>
            {can('booking.edit') ? (
              <Button variant="secondary" onClick={() => setBlockOpen(true)}>
                <Lock className="size-4" /> Block time
              </Button>
            ) : null}
          </>
        }
      />
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-3">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDay(addDaysKey(day, -step))}
              aria-label="Previous"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setDay(todayKey(tz))}>
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDay(addDaysKey(day, step))}
              aria-label="Next"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="text-[15px] font-semibold">
            {view === 'day'
              ? new Intl.DateTimeFormat('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  timeZone: tz,
                }).format(new Date(zonedToUtc(day, '12:00', tz)))
              : `${dayLabel(zonedToUtc(day, '12:00', tz), tz)} – ${dayLabel(zonedToUtc(addDaysKey(day, 6), '12:00', tz), tz)}`}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Legend />
            <Segmented
              value={view}
              onChange={setView}
              items={[
                { value: 'day', label: 'Day' },
                { value: 'week', label: 'Week' },
              ]}
            />
          </div>
        </div>
        {view === 'day' ? (
          <DayGrid
            day={day}
            staff={staff}
            bookings={bookings.data}
            blocks={blocks.data ?? []}
            label={(b) => ({
              title: guestMap.get(b.guestId) ? guestName(guestMap.get(b.guestId)) : 'Guest',
              sub: svcMap.get(b.serviceId ?? '')?.name ?? '',
            })}
          />
        ) : (
          <WeekGrid
            start={day}
            bookings={bookings.data}
            staff={staff}
            svcName={(id) => svcMap.get(id ?? '')?.name ?? ''}
            onPickDay={(d) => {
              setDay(d);
              setView('day');
            }}
          />
        )}
      </Card>
      {blockOpen ? (
        <BlockDialog staff={staff} day={day} onClose={() => setBlockOpen(false)} />
      ) : null}
    </div>
  );
}

function Legend() {
  const items = ['confirmed', 'pending_payment', 'requested', 'checked_in', 'completed'] as const;
  return (
    <div className="hidden items-center gap-3 xl:flex">
      {items.map((s) => (
        <span key={s} className="flex items-center gap-1.5 text-xs text-ink-muted">
          <span className={cn('size-2.5 rounded-sm border', BOOKING_STATE[s].block)} />
          {BOOKING_STATE[s].label}
        </span>
      ))}
    </div>
  );
}

function DayGrid({
  day,
  staff,
  bookings,
  blocks,
  label,
}: {
  day: string;
  staff: Resource[];
  bookings: Booking[];
  blocks: CalendarBlock[];
  label: (b: Booking) => { title: string; sub: string };
}) {
  const { tenant } = useSession();
  const tz = tenant.timezone;
  const can = useCan();
  const drawer = useBookingDrawer();
  const { openNewBooking } = useUi();
  const [dragOver, setDragOver] = useState<string | null>(null);
  const move = useAction(
    (a: { id: string; start: string; staffId: string }) =>
      api.bookings.reschedule(a.id, a.start, a.staffId),
    {
      success: 'Booking moved',
    },
  );

  const todays = bookings.filter(
    (b) => dayKey(b.start, tz) === day && !b.state.startsWith('cancelled'),
  );
  const hours = Array.from({ length: END_H - START_H }, (_, i) => START_H + i);
  const topOf = (iso: string) => {
    const p = zonedParts(iso, tz);
    return ((p.hour - START_H) * 60 + p.minute) * (HOUR_PX / 60);
  };
  const nowTop = dayKey(new Date(), tz) === day ? topOf(new Date().toISOString()) : null;

  const onDrop = (e: DragEvent<HTMLDivElement>, staffId: string) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData('text/booking');
    if (!id) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mins = Math.round((((e.clientY - rect.top) / HOUR_PX) * 60) / 15) * 15 + START_H * 60;
    const hhmm = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    move.mutate({ id, start: zonedToUtc(day, hhmm, tz), staffId });
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="sticky top-0 z-10 flex border-b border-line bg-surface">
          <div className="w-16 shrink-0" />
          {staff.map((s) => (
            <div
              key={s.id}
              className="flex flex-1 items-center gap-2 border-l border-line px-3 py-2.5"
            >
              <Avatar name={s.name} size="sm" />
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium">{s.name.split(' ')[0]}</div>
                <div className="truncate text-[11px] text-ink-subtle">
                  {todays.filter((b) => b.staffId === s.id).length} bookings
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="relative flex">
          <div className="w-16 shrink-0">
            {hours.map((h) => (
              <div
                key={h}
                className="relative text-right text-[11px] text-ink-subtle"
                style={{ height: HOUR_PX }}
              >
                <span
                  className={cn(
                    'absolute right-2 tabular-nums',
                    h === START_H ? 'top-0.5' : '-top-2',
                  )}
                >
                  {String(h).padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>
          {staff.map((s) => (
            <div
              key={s.id}
              className={cn(
                'relative flex-1 border-l border-line',
                dragOver === s.id && 'bg-azure-50/60',
              )}
              style={{ height: hours.length * HOUR_PX }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(s.id);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => onDrop(e, s.id)}
              onClick={(e) => {
                if (!can('booking.create') || e.target !== e.currentTarget) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const mins = Math.floor(((e.clientY - rect.top) / HOUR_PX) * 2) * 30 + START_H * 60;
                openNewBooking({
                  staffId: s.id,
                  day,
                  time: `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`,
                });
              }}
            >
              {hours.map((h) => (
                <div
                  key={h}
                  className="pointer-events-none border-b border-line/70"
                  style={{ height: HOUR_PX }}
                >
                  <div className="h-1/2 border-b border-dashed border-line/50" />
                </div>
              ))}
              {s.schedule?.find(
                (d) =>
                  d.day ===
                  new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: tz }).format(
                    new Date(zonedToUtc(day, '12:00', tz)),
                  ),
              )?.off ? (
                <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgb(0_0_0/0.035)_6px,rgb(0_0_0/0.035)_12px)]">
                  <span className="absolute top-2 left-2 rounded bg-surface px-1.5 py-0.5 text-[11px] text-ink-subtle">
                    Day off
                  </span>
                </div>
              ) : null}
              {blocks
                .filter((bl) => bl.resourceId === s.id && dayKey(bl.start, tz) === day)
                .map((bl) => (
                  <div
                    key={bl.id}
                    className="pointer-events-none absolute inset-x-1 rounded-md border border-dashed border-stone-300 bg-stone-100/80 px-2 py-1 text-[11px] text-stone-600"
                    style={{
                      top: topOf(bl.start),
                      height: Math.max(20, topOf(bl.end) - topOf(bl.start)),
                    }}
                  >
                    <Lock className="mr-1 inline size-3" />
                    {bl.reason}
                  </div>
                ))}
              {todays
                .filter((b) => b.staffId === s.id)
                .map((b) => {
                  const top = topOf(b.start);
                  const height = Math.max(26, topOf(b.end) - top - 2);
                  const l = label(b);
                  const draggable =
                    can('booking.edit') &&
                    ['confirmed', 'pending_payment', 'requested'].includes(b.state);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      draggable={draggable}
                      onDragStart={(e) => e.dataTransfer.setData('text/booking', b.id)}
                      onClick={() => drawer.open(b.id)}
                      className={cn(
                        'absolute inset-x-1 overflow-hidden rounded-lg border-l-[3px] px-2 py-1 text-left shadow-sm transition-shadow hover:shadow-md',
                        BOOKING_STATE[b.state].block,
                        draggable && 'cursor-grab active:cursor-grabbing',
                      )}
                      style={{ top, height }}
                    >
                      <div className="truncate text-[12px] font-semibold">{l.title}</div>
                      {height > 36 ? (
                        <div className="truncate text-[11px] opacity-80">{l.sub}</div>
                      ) : null}
                      {height > 52 ? (
                        <div className="text-[11px] opacity-70 tabular-nums">
                          {time(b.start, tz)}–{time(b.end, tz)}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
            </div>
          ))}
          {nowTop !== null && nowTop > 0 && nowTop < hours.length * HOUR_PX ? (
            <div
              className="pointer-events-none absolute right-0 left-16 z-[5] flex items-center"
              style={{ top: nowTop }}
            >
              <span className="-ml-1 size-2 rounded-full bg-azure-500" />
              <span className="h-px flex-1 bg-azure-500" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function WeekGrid({
  start,
  bookings,
  staff,
  svcName,
  onPickDay,
}: {
  start: string;
  bookings: Booking[];
  staff: Resource[];
  svcName: (id: string | null) => string;
  onPickDay: (day: string) => void;
}) {
  const { tenant } = useSession();
  const tz = tenant.timezone;
  const drawer = useBookingDrawer();
  const days = Array.from({ length: 7 }, (_, i) => addDaysKey(start, i));
  const colour = new Map(staff.map((s) => [s.id, s.colour ?? '#236e56']));
  return (
    <div className="grid grid-cols-1 divide-y divide-line sm:grid-cols-7 sm:divide-x sm:divide-y-0">
      {days.map((d) => {
        const list = bookings
          .filter((b) => dayKey(b.start, tz) === d && !b.state.startsWith('cancelled'))
          .sort((a, b) => a.start.localeCompare(b.start));
        const isToday = d === todayKey(tz);
        return (
          <div key={d} className="min-h-72">
            <button
              type="button"
              onClick={() => onPickDay(d)}
              className={cn(
                'w-full px-3 py-2.5 text-left hover:bg-canvas',
                isToday && 'bg-azure-50',
              )}
            >
              <div className={cn('text-[13px] font-semibold', isToday && 'text-azure-700')}>
                {dayLabel(zonedToUtc(d, '12:00', tz), tz)}
              </div>
              <div className="text-[11px] text-ink-subtle">{list.length} bookings</div>
            </button>
            <ul className="space-y-1 px-2 pb-3">
              {list.slice(0, 9).map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => drawer.open(b.id)}
                    className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] hover:bg-canvas"
                  >
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ background: colour.get(b.staffId ?? '') }}
                    />
                    <span className="font-medium tabular-nums">{time(b.start, tz)}</span>
                    <span className="truncate text-ink-muted">{svcName(b.serviceId)}</span>
                  </button>
                </li>
              ))}
              {list.length > 9 ? (
                <li>
                  <button
                    type="button"
                    onClick={() => onPickDay(d)}
                    className="px-1.5 text-[11px] font-medium text-azure-700"
                  >
                    +{list.length - 9} more
                  </button>
                </li>
              ) : null}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function BlockDialog({
  staff,
  day,
  onClose,
}: {
  staff: Resource[];
  day: string;
  onClose: () => void;
}) {
  const { tenant } = useSession();
  const [who, setWho] = useState(staff[0]?.id ?? '');
  const [d, setD] = useState(day);
  const [from, setFrom] = useState('13:00');
  const [to, setTo] = useState('14:00');
  const [reason, setReason] = useState('Break');
  const add = useAction(
    () =>
      api.team.addBlock(
        who,
        zonedToUtc(d, from, tenant.timezone),
        zonedToUtc(d, to, tenant.timezone),
        reason,
      ),
    { success: 'Time blocked', onSuccess: onClose },
  );
  return (
    <Dialog
      open
      onOpenChange={(o) => (!o ? onClose() : undefined)}
      title="Block time"
      description="Breaks, training or maintenance. Guests can't book blocked time."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => add.mutate(undefined)} loading={add.isPending}>
            <Plus className="size-4" /> Add block
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Who" className="sm:col-span-2">
          {(id) => (
            <Select id={id} value={who} onChange={(e) => setWho(e.target.value)}>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Date" className="sm:col-span-2">
          {(id) => <Input id={id} type="date" value={d} onChange={(e) => setD(e.target.value)} />}
        </Field>
        <Field label="From">
          {(id) => (
            <Input id={id} type="time" value={from} onChange={(e) => setFrom(e.target.value)} />
          )}
        </Field>
        <Field label="To">
          {(id) => <Input id={id} type="time" value={to} onChange={(e) => setTo(e.target.value)} />}
        </Field>
        <Field label="Reason" className="sm:col-span-2">
          {(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
      </div>
    </Dialog>
  );
}

/* =================== Night mode (short-stay): unit × night =================== */

function NightGrid() {
  const { tenant } = useSession();
  const tz = tenant.timezone;
  const can = useCan();
  const [start, setStart] = useState(addDaysKey(todayKey(tz), -2));
  const bookings = useTenantQuery(['bookings'], api.bookings.list);
  const blocks = useTenantQuery(['blocks'], api.blocks);
  const team = useTenantQuery(['team'], api.team.list);
  const guests = useTenantQuery(['guests'], api.guests.list, { enabled: can('guest.view') });
  const drawer = useBookingDrawer();
  const DAYS = 21;
  const COL = 56;
  const nights = useMemo(
    () => Array.from({ length: DAYS }, (_, i) => addDaysKey(start, i)),
    [start],
  );

  if (bookings.error) return <ErrorState error={bookings.error} />;
  if (!bookings.data || !team.data) return <PageSkeleton />;
  const units = team.data.resources.filter((r) => r.type === 'unit');
  const idx = (iso: string) => {
    const k = dayKey(iso, tz);
    const [y1, m1, d1] = start.split('-').map(Number);
    const [y2, m2, d2] = k.split('-').map(Number);
    return Math.round(
      (Date.UTC(y2 ?? 0, (m2 ?? 1) - 1, d2 ?? 1) - Date.UTC(y1 ?? 0, (m1 ?? 1) - 1, d1 ?? 1)) /
        86_400_000,
    );
  };
  const guestMap = new Map((guests.data ?? []).map((g) => [g.id, g]));
  const today = todayKey(tz);

  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Units by night. Imported Airbnb and Booking.com calendars sync every 15 minutes and show as blocks."
      />
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line p-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setStart(addDaysKey(start, -7))}
            aria-label="Previous week"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setStart(addDaysKey(todayKey(tz), -2))}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setStart(addDaysKey(start, 7))}
            aria-label="Next week"
          >
            <ChevronRight className="size-4" />
          </Button>
          <div className="ml-auto flex items-center gap-3 text-xs text-ink-muted">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-emerald-600" /> Booked
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-azure-400" /> Requested
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-stone-300" /> Blocked / imported
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <div style={{ width: 180 + DAYS * COL }}>
            <div className="flex border-b border-line">
              <div className="w-[180px] shrink-0 px-4 py-2 text-xs font-semibold text-ink-muted">
                Unit
              </div>
              {nights.map((n) => (
                <div
                  key={n}
                  className={cn(
                    'shrink-0 border-l border-line py-2 text-center',
                    n === today && 'bg-azure-50',
                  )}
                  style={{ width: COL }}
                >
                  <div className="text-[10px] text-ink-subtle uppercase">
                    {new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: tz }).format(
                      new Date(zonedToUtc(n, '12:00', tz)),
                    )}
                  </div>
                  <div className={cn('text-[13px] font-semibold', n === today && 'text-azure-700')}>
                    {Number(n.slice(8))}
                  </div>
                </div>
              ))}
            </div>
            {units.map((u) => (
              <div
                key={u.id}
                className="relative flex border-b border-line last:border-b-0"
                style={{ height: 64 }}
              >
                <div className="w-[180px] shrink-0 px-4 py-3">
                  <div className="text-sm font-medium">{u.name}</div>
                  <div className="text-[11px] text-ink-subtle">
                    {u.bedrooms} bd · up to {u.maxGuests}
                  </div>
                </div>
                {nights.map((n) => (
                  <div
                    key={n}
                    className={cn('shrink-0 border-l border-line', n === today && 'bg-azure-50/50')}
                    style={{ width: COL }}
                  />
                ))}
                {(blocks.data ?? [])
                  .filter((bl) => bl.resourceId === u.id)
                  .map((bl) => {
                    const a = idx(bl.start);
                    const b = idx(bl.end);
                    if (b < 0 || a >= DAYS) return null;
                    const left = 180 + Math.max(0, a) * COL + COL / 2;
                    const right = 180 + Math.min(DAYS, b) * COL + COL / 2;
                    return (
                      <div
                        key={bl.id}
                        className="absolute top-3 flex h-10 items-center gap-1 overflow-hidden rounded-lg bg-[repeating-linear-gradient(135deg,#e7e5e4,#e7e5e4_6px,#d6d3d1_6px,#d6d3d1_12px)] px-2 text-[11px] font-medium text-stone-700"
                        style={{ left, width: Math.max(24, right - left - 4) }}
                        title={`${bl.reason}${bl.source === 'ical' ? ' (iCal import)' : ''}`}
                      >
                        <Lock className="size-3 shrink-0" />
                        <span className="truncate">{bl.reason}</span>
                      </div>
                    );
                  })}
                {bookings.data
                  .filter((b) => b.unitId === u.id && !b.state.startsWith('cancelled'))
                  .map((b) => {
                    const a = idx(b.start);
                    const e = idx(b.end);
                    if (e < 0 || a >= DAYS) return null;
                    const left = 180 + Math.max(0, a) * COL + COL / 2;
                    const right = 180 + Math.min(DAYS, e) * COL + COL / 2;
                    const g = guestMap.get(b.guestId);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => drawer.open(b.id)}
                        className={cn(
                          'absolute top-3 flex h-10 items-center overflow-hidden rounded-lg px-2.5 text-left text-[12px] font-medium shadow-sm transition-shadow hover:shadow-md',
                          b.state === 'requested'
                            ? 'bg-azure-400 text-white'
                            : b.state === 'completed'
                              ? 'bg-emerald-200 text-emerald-900'
                              : 'bg-emerald-600 text-white',
                        )}
                        style={{ left, width: Math.max(24, right - left - 4) }}
                      >
                        <span className="truncate">
                          {g ? guestName(g) : 'Guest'} · {b.guests}
                        </span>
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
