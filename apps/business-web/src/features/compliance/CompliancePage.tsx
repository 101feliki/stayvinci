import { useState } from 'react';
import { FileCheck2, FileWarning, Lock } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Dialog,
  Field,
  Input,
  PageHeader,
  Table,
  Td,
  Th,
  Tr,
} from '@stayvinci/ui';
import { api } from '../../mock/api';
import type { Resource } from '../../mock/types';
import { useSession } from '../../app/session';
import { ErrorState, PageSkeleton } from '../../components/common';
import { date, money } from '../../lib/format';
import { useAction, useTenantQuery } from '../../lib/query';

/** Short-stay compliance: TRA licences, guest registration, tourism levy (spec §10.6, §21). */
export function CompliancePage() {
  const { tenant } = useSession();
  const q = useTenantQuery(['compliance'], api.compliance.get);
  const [edit, setEdit] = useState<Resource | null>(null);
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <PageSkeleton />;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance"
        description="Licences, guest registration records and tourism levy reports for your units."
      />
      <Card>
        <CardHeader
          title="TRA licences"
          description="Each listed unit needs a valid Tourism Regulatory Authority licence."
        />
        <ul className="divide-y divide-line">
          {q.data.units.map((u) => (
            <li key={u.id} className="flex items-center gap-4 px-5 py-3.5">
              {u.traLicence ? (
                <FileCheck2 className="size-5 text-emerald-600" />
              ) : (
                <FileWarning className="size-5 text-red-600" />
              )}
              <div className="flex-1">
                <div className="text-sm font-medium">{u.name}</div>
                <div className="font-mono text-xs text-ink-subtle">
                  {u.traLicence || 'No licence on file'}
                </div>
              </div>
              {u.traLicence ? (
                <Badge tone="emerald">Valid</Badge>
              ) : (
                <Badge tone="red">Missing</Badge>
              )}
              <Button size="sm" variant="secondary" onClick={() => setEdit(u)}>
                {u.traLicence ? 'Update' : 'Add licence'}
              </Button>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader
          title="Guest registration records"
          description="Encrypted, visible only to authorised roles, and deleted automatically after the legal retention period."
          action={<Lock className="size-4 text-ink-subtle" />}
        />
        <Table>
          <thead>
            <tr>
              <Th>Guest</Th>
              <Th>Nationality</Th>
              <Th>ID</Th>
              <Th>Check-in</Th>
            </tr>
          </thead>
          <tbody>
            {q.data.registrations.map((r) => (
              <Tr key={r.id}>
                <Td className="font-medium">{r.fullName}</Td>
                <Td>{r.nationality}</Td>
                <Td className="font-mono text-xs">{r.idMasked}</Td>
                <Td className="text-ink-muted">{date(r.at, tenant.timezone)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <Card>
        <CardHeader
          title="Tourism levy reports"
          description="Monthly taxable amounts from completed stays."
        />
        <Table>
          <thead>
            <tr>
              <Th>Period</Th>
              <Th className="text-right">Nights</Th>
              <Th className="text-right">Taxable amount</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {q.data.levy.map((l) => (
              <Tr key={l.id}>
                <Td className="font-medium">{l.period}</Td>
                <Td className="text-right tabular-nums">{l.nights}</Td>
                <Td className="text-right tabular-nums">{money(l.taxable)}</Td>
                <Td>
                  <Badge tone={l.status === 'filed' ? 'emerald' : 'amber'}>
                    {l.status === 'filed' ? 'Filed' : 'Ready to file'}
                  </Badge>
                </Td>
                <Td className="text-right">
                  <Button size="sm" variant="ghost">
                    Download
                  </Button>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
      {edit ? <LicenceDialog unit={edit} onClose={() => setEdit(null)} /> : null}
    </div>
  );
}

function LicenceDialog({ unit, onClose }: { unit: Resource; onClose: () => void }) {
  const [v, setV] = useState(unit.traLicence ?? '');
  const save = useAction(() => api.compliance.saveLicence(unit.id, v), {
    success: 'Licence saved',
    onSuccess: onClose,
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => (!o ? onClose() : undefined)}
      title={`TRA licence for ${unit.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => save.mutate(undefined)}
            disabled={!v.trim()}
            loading={save.isPending}
          >
            Save
          </Button>
        </>
      }
    >
      <Field label="Licence number">
        {(id) => (
          <Input
            id={id}
            value={v}
            onChange={(e) => setV(e.target.value)}
            placeholder="TRA/STA/2026/0000"
            className="font-mono"
          />
        )}
      </Field>
    </Dialog>
  );
}
