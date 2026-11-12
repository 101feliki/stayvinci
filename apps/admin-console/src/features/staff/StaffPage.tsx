import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, ShieldCheck, UserPlus } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Dialog,
  Field,
  Input,
  PageHeader,
  Select,
  Table,
  Td,
  Th,
  Tr,
} from '@stayvinci/ui';
import { relative } from '@stayvinci/demo-data/format';
import {
  PLATFORM_ROLE_LABELS,
  PLATFORM_ROLE_SUMMARY,
  type PlatformRole,
} from '@stayvinci/demo-data/platform';
import { api } from '../../mock/api';
import { ErrorState, PageSkeleton } from '../../components/common';
import { useAction } from '../../lib/query';

const ROLES = Object.keys(PLATFORM_ROLE_LABELS) as PlatformRole[];

/** Stayvinci's own team and what each role can do (spec §1 platform roles). */
export function StaffPage() {
  const q = useQuery({ queryKey: ['staff'], queryFn: api.staff.list });
  const [inviting, setInviting] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'admin' as PlatformRole });
  const setRole = useAction(
    ({ id, role }: { id: string; role: PlatformRole }) => api.staff.setRole(id, role),
    { success: 'Role updated' },
  );
  const invite = useAction(() => api.staff.invite(form.name, form.email, form.role), {
    success: 'Invite sent',
    onSuccess: () => {
      setInviting(false);
      setForm({ name: '', email: '', role: 'admin' });
    },
  });
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff & roles"
        description="Everyone at Stayvinci who can use the console. Two-step verification is required."
        actions={
          <Button onClick={() => setInviting(true)}>
            <UserPlus className="size-4" /> Invite
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ROLES.map((r) => (
          <Card key={r} className="p-4">
            <div className="font-semibold">{PLATFORM_ROLE_LABELS[r]}</div>
            <div className="mt-1 text-[13px] text-ink-muted">{PLATFORM_ROLE_SUMMARY[r]}</div>
          </Card>
        ))}
      </div>
      <Card className="overflow-hidden">
        <Table>
          <thead>
            <tr>
              <Th>Person</Th>
              <Th>Role</Th>
              <Th>Two-step</Th>
              <Th>Last active</Th>
            </tr>
          </thead>
          <tbody>
            {q.data.map((s) => (
              <Tr key={s.id}>
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar name={s.name} size="sm" tone="gold" />
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-ink-subtle">{s.email}</div>
                    </div>
                    {s.status === 'invited' ? <Badge tone="azure">Invited</Badge> : null}
                  </div>
                </Td>
                <Td>
                  <Select
                    value={s.role}
                    onChange={(e) =>
                      setRole.mutate({ id: s.id, role: e.target.value as PlatformRole })
                    }
                    aria-label={`Role for ${s.name}`}
                    className="w-40"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {PLATFORM_ROLE_LABELS[r]}
                      </option>
                    ))}
                  </Select>
                </Td>
                <Td>
                  {s.twoFactor ? (
                    <span className="flex items-center gap-1.5 text-sm text-emerald-700">
                      <ShieldCheck className="size-4" /> On
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-sm text-amber-700">
                      <ShieldAlert className="size-4" /> Set up at first sign-in
                    </span>
                  )}
                </Td>
                <Td className="text-ink-muted">{s.lastActive ? relative(s.lastActive) : '—'}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <Dialog
        open={inviting}
        onOpenChange={setInviting}
        title="Invite a team member"
        footer={
          <>
            <Button variant="secondary" onClick={() => setInviting(false)}>
              Cancel
            </Button>
            <Button loading={invite.isPending} onClick={() => invite.mutate(undefined)}>
              Send invite
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Full name">
            {(id) => (
              <Input
                id={id}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            )}
          </Field>
          <Field label="Work email">
            {(id) => (
              <Input
                id={id}
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            )}
          </Field>
          <Field label="Role" hint={PLATFORM_ROLE_SUMMARY[form.role]}>
            {(id) => (
              <Select
                id={id}
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as PlatformRole })}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {PLATFORM_ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
