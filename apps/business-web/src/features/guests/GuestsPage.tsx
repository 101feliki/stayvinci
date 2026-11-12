import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Download, Search, Upload, Users } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Segmented,
  StatTile,
  Table,
  Td,
  Textarea,
  Th,
  Tr,
} from '@stayvinci/ui';
import { api } from '../../mock/api';
import { useCan, useSession } from '../../app/session';
import { ErrorState, HiddenContact, PageSkeleton, downloadCsv } from '../../components/common';
import { date, guestName, money } from '../../lib/format';
import { useAction, useTenantQuery } from '../../lib/query';

type Filter = 'all' | 'own_channel' | 'marketplace' | 'members' | 'lapsed';

export function GuestsPage() {
  const { tenant } = useSession();
  const can = useCan();
  const navigate = useNavigate();
  const guests = useTenantQuery(['guests'], api.guests.list);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [importOpen, setImportOpen] = useState(false);
  const showContacts = can('guest.contact.view');

  const rows = useMemo(() => {
    const cutoff = new Date(Date.now() - 60 * 86_400_000).toISOString();
    return (guests.data ?? [])
      .filter((g) => {
        if (filter === 'own_channel' || filter === 'marketplace')
          if (g.attribution !== filter) return false;
        if (filter === 'members' && !g.membershipTierId) return false;
        if (filter === 'lapsed' && (!g.lastVisit || g.lastVisit > cutoff)) return false;
        if (
          q &&
          !`${g.firstName} ${g.lastName} ${g.alias ?? ''}`.toLowerCase().includes(q.toLowerCase())
        )
          return false;
        return true;
      })
      .sort((a, b) => (b.lastVisit ?? '').localeCompare(a.lastVisit ?? ''));
  }, [guests.data, q, filter]);

  if (guests.error) return <ErrorState error={guests.error} />;
  if (!guests.data) return <PageSkeleton />;

  const all = guests.data;
  const market = all.filter((g) => g.attribution === 'marketplace').length;

  return (
    <div>
      <PageHeader
        title="Guests"
        description="Guests admitted to your store. You only ever see their activity with you, never with other Houses."
        actions={
          <>
            {can('guest.export') ? (
              <Button
                variant="secondary"
                onClick={() =>
                  downloadCsv('guests.csv', [
                    ['Name', 'Phone', 'Email', 'Source', 'Visits', 'Spend (KES)', 'Last visit'],
                    ...rows.map((g) => [
                      guestName(g),
                      g.phone ?? '',
                      g.email ?? '',
                      g.attributionDetail,
                      g.visits,
                      g.spend / 100,
                      g.lastVisit ? date(g.lastVisit, tenant.timezone) : '',
                    ]),
                  ])
                }
              >
                <Download className="size-4" /> Export
              </Button>
            ) : null}
            {can('guest.import') ? (
              <Button variant="secondary" onClick={() => setImportOpen(true)}>
                <Upload className="size-4" /> Import guests
              </Button>
            ) : null}
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Admitted guests" value={all.length} />
        <StatTile
          label="Your own channel"
          value={all.length - market}
          sub="Never charged a fee"
          accent="emerald"
        />
        <StatTile
          label="From marketplace"
          value={market}
          sub="Fee on first completed booking only"
          accent="gold"
        />
        <StatTile
          label="Members"
          value={all.filter((g) => g.membershipTierId).length}
          accent="plum"
        />
      </div>
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle" />
            <Input
              className="pl-9"
              placeholder="Search by name or alias"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Segmented
            value={filter}
            onChange={setFilter}
            className="overflow-x-auto"
            items={[
              { value: 'all', label: 'All' },
              { value: 'own_channel', label: 'Own channel' },
              { value: 'marketplace', label: 'Marketplace' },
              { value: 'members', label: 'Members' },
              { value: 'lapsed', label: 'Lapsed 60d+' },
            ]}
          />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={<Users className="size-5" />} title="No guests match" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Guest</Th>
                <Th className="hidden md:table-cell">Phone</Th>
                <Th>Source</Th>
                <Th className="text-right">Visits</Th>
                <Th className="hidden text-right sm:table-cell">Spend</Th>
                <Th className="hidden lg:table-cell">Last visit</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <Tr
                  key={g.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/guests/${g.id}`)}
                >
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={guestName(g)}
                        size="sm"
                        tone={g.membershipTierId ? 'plum' : 'emerald'}
                      />
                      <div>
                        <div className="font-medium">
                          {guestName(g)}
                          {g.tags.includes('VIP') ? (
                            <Badge tone="gold" className="ml-2">
                              VIP
                            </Badge>
                          ) : null}
                        </div>
                        {g.alias ? (
                          <div className="text-xs text-ink-subtle">Booking under an alias</div>
                        ) : null}
                      </div>
                    </div>
                  </Td>
                  <Td className="hidden md:table-cell">
                    {showContacts ? (
                      <span className="tabular-nums">{g.phone}</span>
                    ) : (
                      <HiddenContact />
                    )}
                  </Td>
                  <Td>
                    <Badge tone={g.attribution === 'marketplace' ? 'gold' : 'emerald'}>
                      {g.attribution === 'marketplace' ? 'Marketplace' : 'Own channel'}
                    </Badge>
                  </Td>
                  <Td className="text-right tabular-nums">{g.visits}</Td>
                  <Td className="hidden text-right tabular-nums sm:table-cell">{money(g.spend)}</Td>
                  <Td className="hidden text-ink-muted lg:table-cell">
                    {g.lastVisit ? date(g.lastVisit, tenant.timezone) : '—'}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {importOpen ? <ImportDialog onClose={() => setImportOpen(false)} /> : null}
    </div>
  );
}

function ImportDialog({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('Jane Wanjiru, +254 711 222 333\nOmar Abdi, +254 722 444 555');
  const [lawful, setLawful] = useState(false);
  const rows = text
    .split('\n')
    .map((l) => l.split(',').map((x) => x.trim()))
    .filter((p) => p[0] && p[1])
    .map(([name = '', phone = '']) => {
      const [firstName = '', ...rest] = name.split(' ');
      return { firstName, lastName: rest.join(' '), phone };
    });
  const imp = useAction(() => api.guests.import(rows), {
    success: (n) => `${n} guests imported`,
    onSuccess: onClose,
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => (!o ? onClose() : undefined)}
      title="Import your existing guests"
      description="Imported phone numbers are attributed to your own channel, so no marketplace fee ever applies to them."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => imp.mutate(undefined)}
            disabled={!lawful || rows.length === 0}
            loading={imp.isPending}
          >
            Import {rows.length} guests
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="One guest per line: name, phone"
          hint="You can also paste from a spreadsheet."
        >
          {(id) => (
            <Textarea
              id={id}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-32 font-mono text-[13px]"
            />
          )}
        </Field>
        <Checkbox
          checked={lawful}
          onChange={setLawful}
          label="I confirm we have a lawful basis to contact these people (Kenya Data Protection Act)."
        />
      </div>
    </Dialog>
  );
}
