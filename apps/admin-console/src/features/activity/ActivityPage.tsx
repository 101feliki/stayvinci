import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { Badge, Button, Card, PageHeader, Select, Table, Td, Th, Tr } from '@stayvinci/ui';
import { dateTime } from '@stayvinci/demo-data/format';
import { PLATFORM_ROLE_LABELS, type PlatformRole } from '@stayvinci/demo-data/platform';
import { api } from '../../mock/api';
import { ErrorState, PageSkeleton, downloadCsv } from '../../components/common';

const ROLE_LABEL = (r: string) =>
  r === 'system'
    ? 'System'
    : r === 'house_owner'
      ? 'House owner'
      : PLATFORM_ROLE_LABELS[r as PlatformRole];

/** Global audit log (spec §13): every privileged action, filterable and exportable. */
export function ActivityPage() {
  const q = useQuery({ queryKey: ['audit'], queryFn: api.audit.list });
  const [house, setHouse] = useState('all');
  const [actor, setActor] = useState('all');
  const rows = useMemo(
    () =>
      (q.data?.entries ?? []).filter(
        (a) => (house === 'all' || a.tenantId === house) && (actor === 'all' || a.actor === actor),
      ),
    [q.data, house, actor],
  );
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <PageSkeleton />;
  const actors = [...new Set(q.data.entries.map((a) => a.actor))];
  const nameOf = (id: string | null) =>
    id ? (q.data.tenants.find((t) => t.id === id)?.name ?? id) : '—';

  return (
    <div className="space-y-4">
      <PageHeader
        title="Activity log"
        description="Every change made by Stayvinci staff, House owners and the system."
        actions={
          <Button
            variant="secondary"
            onClick={() =>
              downloadCsv('stayvinci-activity.csv', [
                ['time_utc', 'actor', 'role', 'action', 'house', 'detail'],
                ...rows.map((a) => [a.at, a.actor, a.role, a.action, nameOf(a.tenantId), a.detail]),
              ])
            }
          >
            <Download className="size-4" /> Export
          </Button>
        }
      />
      <div className="flex flex-wrap gap-3">
        <Select
          value={house}
          onChange={(e) => setHouse(e.target.value)}
          aria-label="House"
          className="w-56"
        >
          <option value="all">All Houses</option>
          {q.data.tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <Select
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          aria-label="Who"
          className="w-48"
        >
          <option value="all">Anyone</option>
          {actors.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
      </div>
      <Card className="overflow-hidden">
        <Table>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Who</Th>
              <Th>What</Th>
              <Th>House</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <Tr key={a.id}>
                <Td className="whitespace-nowrap text-ink-muted">
                  {dateTime(a.at, 'Africa/Nairobi')}
                </Td>
                <Td>
                  {a.actor}
                  <div>
                    <Badge
                      tone={
                        a.role === 'system'
                          ? 'amber'
                          : a.role === 'house_owner'
                            ? 'neutral'
                            : 'gold'
                      }
                    >
                      {ROLE_LABEL(a.role)}
                    </Badge>
                  </div>
                </Td>
                <Td>
                  {a.detail}
                  <div className="font-mono text-xs text-ink-subtle">{a.action}</div>
                </Td>
                <Td>
                  {a.tenantId ? (
                    <Link to={`/houses/${a.tenantId}`} className="hover:underline">
                      {nameOf(a.tenantId)}
                    </Link>
                  ) : (
                    <span className="text-ink-subtle">Platform</span>
                  )}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
