import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { DoorOpen, Mail, Plus, ShieldCheck, ShieldOff, UserPlus, Wrench } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  Drawer,
  Field,
  Input,
  PageHeader,
  Select,
  Switch,
  Table,
  Tabs,
  Td,
  Th,
  Tr,
  cn,
} from '@stayvinci/ui';
import { api } from '../../lib/api';
import type { Capability, Resource, TeamMember, TenantRole } from '../../mock/types';
import { useCan, useSession } from '../../app/session';
import { ErrorState, PageSkeleton } from '../../components/common';
import { CAPABILITY_GROUPS, ROLE_BUNDLES, ROLE_LABELS } from '../../lib/capabilities';
import { relative } from '../../lib/format';
import { useAction, useTenantQuery } from '../../lib/query';

type Tab = 'members' | 'staff' | 'resources';

export function TeamPage() {
  const { tenant } = useSession();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab | null) ?? 'members';
  const team = useTenantQuery(['team'], api.team.list);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [resEdit, setResEdit] = useState<Resource | null>(null);

  if (team.error) return <ErrorState error={team.error} />;
  if (!team.data) return <PageSkeleton />;
  const { members, resources } = team.data;
  const staff = resources.filter((r) => r.type === 'staff');
  const others = resources.filter((r) => r.type !== 'staff');

  return (
    <div>
      <PageHeader
        title="Team & resources"
        description="Who can sign in and what they can do, plus the people, rooms and units guests book."
        actions={
          tab === 'members' ? (
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="size-4" /> Invite
            </Button>
          ) : tab === 'resources' ? (
            <Button
              onClick={() =>
                setResEdit({
                  id: '',
                  tenantId: tenant.id,
                  type: tenant.vertical === 'spa' ? 'room' : 'unit',
                  name: '',
                  locationId: team.data.locations[0]?.id ?? '',
                  capacity: 1,
                  visible: false,
                })
              }
            >
              <Plus className="size-4" /> Add{' '}
              {tenant.vertical === 'spa' ? 'room or equipment' : 'unit'}
            </Button>
          ) : null
        }
      />
      <Tabs
        value={tab}
        onChange={(t) => setParams({ tab: t })}
        className="mb-5"
        items={[
          { value: 'members', label: 'Sign-in & roles', count: members.length },
          ...(staff.length
            ? [{ value: 'staff' as const, label: 'Staff profiles', count: staff.length }]
            : []),
          {
            value: 'resources',
            label: tenant.vertical === 'spa' ? 'Rooms & equipment' : 'Units',
            count: others.length,
          },
        ]}
      />

      {tab === 'members' ? (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Person</Th>
                <Th>Role</Th>
                <Th className="hidden md:table-cell">2-step</Th>
                <Th className="hidden md:table-cell">Last active</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <Tr key={m.id} className="cursor-pointer" onClick={() => setEditing(m)}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={m.name}
                        size="sm"
                        tone={m.role === 'owner' ? 'gold' : 'emerald'}
                      />
                      <div>
                        <div className="font-medium">{m.name}</div>
                        <div className="text-xs text-ink-subtle">{m.email}</div>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={m.role === 'owner' ? 'gold' : 'neutral'}>
                        {ROLE_LABELS[m.role]}
                      </Badge>
                      {m.added.length + m.removed.length > 0 ? (
                        <Badge tone="azure">{m.added.length + m.removed.length} overrides</Badge>
                      ) : null}
                      {m.status === 'invited' ? <Badge tone="amber">Invited</Badge> : null}
                    </div>
                  </Td>
                  <Td className="hidden md:table-cell">
                    {m.twoFactor ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-700">
                        <ShieldCheck className="size-4" /> On
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-amber-700">
                        <ShieldOff className="size-4" /> Not set up
                      </span>
                    )}
                  </Td>
                  <Td className="hidden text-ink-muted md:table-cell">
                    {m.lastActive ? relative(m.lastActive) : '—'}
                  </Td>
                  <Td className="text-right text-[13px] font-medium text-azure-700">Permissions</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}

      {tab === 'staff' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {staff.map((s) => (
            <Card key={s.id} className="p-5">
              <div className="flex items-center gap-3">
                <Avatar name={s.name} size="lg" />
                <div className="flex-1">
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-[13px] text-ink-muted">{s.title}</div>
                </div>
                {s.guestsCanChoose ? <Badge tone="azure">Guests can choose</Badge> : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {s.specialties?.map((x) => (
                  <Badge key={x} tone="emerald">
                    {x}
                  </Badge>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-7 gap-1">
                {s.schedule?.map((d) => (
                  <div
                    key={d.day}
                    className={cn(
                      'rounded-lg py-1.5 text-center text-[10px]',
                      d.off ? 'bg-stone-100 text-ink-subtle' : 'bg-emerald-50 text-emerald-800',
                    )}
                  >
                    <div className="font-semibold">{d.day.slice(0, 2)}</div>
                    <div>{d.off ? 'Off' : d.start.slice(0, 2)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs text-ink-subtle">Speaks {s.languages?.join(', ')}</div>
            </Card>
          ))}
        </div>
      ) : null}

      {tab === 'resources' ? (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Type</Th>
                <Th className="text-right">Capacity</Th>
                <Th className="hidden sm:table-cell">Shown to guests</Th>
              </tr>
            </thead>
            <tbody>
              {others.map((r) => (
                <Tr key={r.id} className="cursor-pointer" onClick={() => setResEdit(r)}>
                  <Td>
                    <div className="flex items-center gap-2 font-medium">
                      {r.type === 'equipment' ? (
                        <Wrench className="size-4 text-ink-subtle" />
                      ) : (
                        <DoorOpen className="size-4 text-ink-subtle" />
                      )}
                      {r.name}
                    </div>
                    {r.type === 'unit' ? (
                      <div className="text-xs text-ink-subtle">{r.amenities?.join(' · ')}</div>
                    ) : null}
                  </Td>
                  <Td className="capitalize">{r.type}</Td>
                  <Td className="text-right tabular-nums">{r.capacity}</Td>
                  <Td className="hidden sm:table-cell">{r.visible ? 'Yes' : 'Internal'}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}

      {editing ? <MemberDrawer member={editing} onClose={() => setEditing(null)} /> : null}
      {inviteOpen ? <InviteDialog onClose={() => setInviteOpen(false)} /> : null}
      {resEdit ? <ResourceDialog resource={resEdit} onClose={() => setResEdit(null)} /> : null}
    </div>
  );
}

function MemberDrawer({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const can = useCan();
  const [role, setRole] = useState<TenantRole>(member.role);
  const [added, setAdded] = useState<Capability[]>(member.added);
  const [removed, setRemoved] = useState<Capability[]>(member.removed);
  const save = useAction(() => api.team.updateMember(member.id, { role, added, removed }), {
    success: 'Permissions saved',
    onSuccess: onClose,
  });
  const removeMember = useAction(() => api.team.removeMember(member.id), {
    success: 'Removed',
    onSuccess: onClose,
  });
  const bundle = new Set(ROLE_BUNDLES[role]);
  const has = (c: Capability) => (bundle.has(c) && !removed.includes(c)) || added.includes(c);
  const toggle = (c: Capability, on: boolean) => {
    if (bundle.has(c)) setRemoved((r) => (on ? r.filter((x) => x !== c) : [...r, c]));
    else setAdded((a) => (on ? [...a, c] : a.filter((x) => x !== c)));
  };

  return (
    <Drawer
      open
      onOpenChange={(o) => (!o ? onClose() : undefined)}
      width="lg"
      title={member.name}
      description="Choose a role, then add or remove single permissions for this person."
      footer={
        <>
          {member.role !== 'owner' ? (
            <Button
              variant="ghost"
              className="mr-auto text-red-700 hover:bg-red-50"
              onClick={() => removeMember.mutate(undefined)}
            >
              Remove access
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate(undefined)} loading={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <Field label="Role">
          {(id) => (
            <Select
              id={id}
              value={role}
              onChange={(e) => {
                setRole(e.target.value as TenantRole);
                setAdded([]);
                setRemoved([]);
              }}
            >
              {(Object.keys(ROLE_LABELS) as TenantRole[])
                .filter((r) => r !== 'owner' || can('billing.manage'))
                .map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
            </Select>
          )}
        </Field>
        <div className="rounded-xl border border-gold-200 bg-gold-50 px-4 py-3 text-[13px] text-gold-800">
          Phone and email of guests are owner-only by default. Turning on “See phone and email” for
          someone lets them contact your guests directly.
        </div>
        {CAPABILITY_GROUPS.map((g) => (
          <div key={g.label}>
            <div className="mb-2 text-[13px] font-semibold text-ink-muted uppercase">{g.label}</div>
            <div className="divide-y divide-line rounded-xl border border-line">
              {g.items.map((item) => {
                const on = has(item.cap);
                const overridden = added.includes(item.cap) || removed.includes(item.cap);
                return (
                  <div key={item.cap} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex-1">
                      <div className="text-sm">{item.label}</div>
                      <div className="font-mono text-[11px] text-ink-subtle">{item.cap}</div>
                    </div>
                    {overridden ? <Badge tone="azure">Override</Badge> : null}
                    <Switch
                      checked={on}
                      onChange={(v) => toggle(item.cap, v)}
                      label={item.label}
                      disabled={role === 'owner'}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Drawer>
  );
}

function InviteDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TenantRole>('front_desk');
  const invite = useAction(() => api.team.invite(name, email, role), {
    success: 'Invitation sent',
    onSuccess: onClose,
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => (!o ? onClose() : undefined)}
      title="Invite someone"
      description="They'll set up two-step verification when they first sign in."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => invite.mutate(undefined)}
            loading={invite.isPending}
            disabled={!name || !email}
          >
            <Mail className="size-4" /> Send invite
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Full name">
          {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="Email">
          {(id) => (
            <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          )}
        </Field>
        <Field label="Role">
          {(id) => (
            <Select id={id} value={role} onChange={(e) => setRole(e.target.value as TenantRole)}>
              {(Object.keys(ROLE_LABELS) as TenantRole[])
                .filter((r) => r !== 'owner')
                .map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
            </Select>
          )}
        </Field>
      </div>
    </Dialog>
  );
}

function ResourceDialog({ resource, onClose }: { resource: Resource; onClose: () => void }) {
  const [r, setR] = useState(resource);
  const save = useAction(() => api.team.saveResource(r), { success: 'Saved', onSuccess: onClose });
  return (
    <Dialog
      open
      onOpenChange={(o) => (!o ? onClose() : undefined)}
      title={resource.id ? `Edit ${resource.name}` : 'Add a resource'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => save.mutate(undefined)}
            loading={save.isPending}
            disabled={!r.name}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2">
          {(id) => (
            <Input id={id} value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} />
          )}
        </Field>
        <Field label="Type">
          {(id) => (
            <Select
              id={id}
              value={r.type}
              onChange={(e) => setR({ ...r, type: e.target.value as Resource['type'] })}
            >
              <option value="room">Room</option>
              <option value="equipment">Equipment</option>
              <option value="unit">Unit</option>
            </Select>
          )}
        </Field>
        <Field label="Capacity">
          {(id) => (
            <Input
              id={id}
              type="number"
              min={1}
              value={r.capacity}
              onChange={(e) => setR({ ...r, capacity: Number(e.target.value) })}
            />
          )}
        </Field>
        <Checkbox
          checked={r.visible}
          onChange={(v) => setR({ ...r, visible: v })}
          label="Show to guests"
          className="sm:col-span-2"
        />
      </div>
    </Dialog>
  );
}
