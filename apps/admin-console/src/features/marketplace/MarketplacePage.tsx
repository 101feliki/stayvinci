import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Badge, Card, PageHeader, Switch, Table, Td, Th, Tr } from '@stayvinci/ui';
import { api } from '../../mock/api';
import { ErrorState, PageSkeleton } from '../../components/common';
import { useAction } from '../../lib/query';

const VIS = {
  private: { label: 'Private (code only)', tone: 'neutral' },
  listed: { label: 'Listed', tone: 'emerald' },
  listed_limited: { label: 'Listed, limited', tone: 'azure' },
} as const;

/** Marketplace (spec §6, §13 "Content and marketplace"): who appears in Discover and who is featured. */
export function MarketplacePage() {
  const q = useQuery({ queryKey: ['marketplace'], queryFn: api.marketplace.list });
  const feature = useAction(
    ({ id, on }: { id: string; on: boolean }) => api.marketplace.setFeatured(id, on),
    { success: 'Discover updated' },
  );
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <PageSkeleton />;

  return (
    <div>
      <PageHeader
        title="Marketplace"
        description="Houses that are live. Private Houses never appear in Discover; the owner decides whether to list."
      />
      <Card className="overflow-hidden">
        <Table>
          <thead>
            <tr>
              <Th>House</Th>
              <Th>Visibility</Th>
              <Th>Plan allows listing</Th>
              <Th className="text-right">Guests from marketplace</Th>
              <Th>Featured in Discover</Th>
            </tr>
          </thead>
          <tbody>
            {q.data.map((t) => (
              <Tr key={t.id}>
                <Td>
                  <Link to={`/houses/${t.id}`} className="font-medium hover:underline">
                    {t.name}
                  </Link>
                  <div className="text-xs text-ink-subtle">
                    {t.category} · {t.area}
                  </div>
                </Td>
                <Td>
                  <Badge tone={VIS[t.visibility].tone}>{VIS[t.visibility].label}</Badge>
                </Td>
                <Td>{t.entitled ? 'Yes' : <span className="text-ink-subtle">No</span>}</Td>
                <Td className="text-right tabular-nums">{t.marketplaceGuests}</Td>
                <Td>
                  <Switch
                    checked={t.featured}
                    onChange={(on) => feature.mutate({ id: t.id, on })}
                    label={`Feature ${t.name}`}
                  />
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
