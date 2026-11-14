import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ExternalLink, History, Monitor, Smartphone, Tablet } from 'lucide-react';
import { Badge, Button, Card, PageHeader, Segmented, Tabs, cn } from '@stayvinci/ui';
import { basePalette } from '@stayvinci/demo-data/design';
import { api } from '../../lib/api';
import type { SectionKind, Storefront } from '../../mock/types';
import { useSession } from '../../app/session';
import { ErrorState, PageSkeleton } from '../../components/common';
import { dateTime } from '../../lib/format';
import { useAction, useTenantQuery } from '../../lib/query';
import { BrandPanel } from './BrandPanel';
import { CoverPanel } from './CoverPanel';
import { ColoursPanel } from './ColoursPanel';
import { SectionsPanel } from './SectionsPanel';
import { MarqueePanel } from './MarqueePanel';
import { SeasonPanel } from './SeasonPanel';
import { StorePreview } from './StorePreview';

const TABS = ['brand', 'cover', 'colours', 'sections', 'marquee', 'season', 'history'] as const;
type Tab = (typeof TABS)[number];

/** Storefront designer (spec §5.2): brand, colours, sections, marquee and seasons, with live preview. */
export function StorefrontPage() {
  const { tenant } = useSession();
  const sf = useTenantQuery(['storefront'], api.storefront.get);
  const cat = useTenantQuery(['catalogue'], api.catalogue.get);
  const [draft, setDraft] = useState<Storefront | null>(null);
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>('brand');
  // Deep links from search, e.g. /storefront?tab=season, also while already on this page.
  useEffect(() => {
    const t = params.get('tab');
    const found = TABS.find((x) => x === t);
    if (found) setTab(found);
  }, [params]);
  const [device, setDevice] = useState<'phone' | 'tablet' | 'desktop'>('phone');
  const [focus, setFocus] = useState<SectionKind | null>(null);
  const [base, setBase] = useState('#236E56');
  const save = useAction((s: Storefront) => api.storefront.save(s), { success: 'Draft saved' });
  const publish = useAction(() => api.storefront.publish(), {
    success: 'Published. Guests now see the new version.',
  });
  const rollback = useAction((id: string) => api.storefront.rollback(id), {
    success: 'Rolled back',
  });

  useEffect(() => {
    if (sf.data) {
      setDraft(sf.data);
      setBase(basePalette(sf.data).bg === '#1C1C1E' ? '#C8A96A' : basePalette(sf.data).bg);
    }
  }, [sf.data]);

  if (sf.error) return <ErrorState error={sf.error} />;
  if (!sf.data || !draft) return <PageSkeleton />;

  const dirty = JSON.stringify(draft) !== JSON.stringify(sf.data);
  const set = (patch: Partial<Storefront>) => setDraft({ ...draft, ...patch });
  const services = cat.data?.services ?? [];

  return (
    <div>
      <PageHeader
        title="Storefront"
        description={`Design your private store at ${tenant.handle.toLowerCase()}.stayvinci.com. Changes save as a draft and go live when you publish.`}
        actions={
          <>
            {dirty ? (
              <Badge tone="azure">Not saved</Badge>
            ) : sf.data.hasDraft ? (
              <Badge tone="amber">Unpublished changes</Badge>
            ) : null}
            <Button
              variant="secondary"
              disabled={!dirty}
              onClick={() => save.mutate(draft)}
              loading={save.isPending}
            >
              Save draft
            </Button>
            <Button
              variant="gold"
              onClick={() =>
                dirty
                  ? save.mutateAsync(draft).then(() => publish.mutate(undefined))
                  : publish.mutate(undefined)
              }
              loading={publish.isPending}
            >
              Publish changes
            </Button>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,500px)_1fr]">
        <Card className="min-w-0 self-start overflow-hidden">
          <div className="overflow-x-auto px-3 [scrollbar-width:none]">
            <Tabs
              value={tab}
              onChange={(t) => {
                setTab(t);
                if (t !== 'sections') setFocus(null);
              }}
              items={[
                { value: 'brand', label: 'Brand' },
                { value: 'cover', label: 'Cover' },
                { value: 'colours', label: 'Colours' },
                { value: 'sections', label: 'Sections' },
                { value: 'marquee', label: 'Marquee' },
                { value: 'season', label: 'Season' },
                { value: 'history', label: 'History' },
              ]}
            />
          </div>
          {tab === 'brand' ? (
            <BrandPanel
              draft={draft}
              set={set}
              onLogoColour={(c) => {
                setBase(c);
              }}
            />
          ) : null}
          {tab === 'cover' ? <CoverPanel draft={draft} set={set} /> : null}
          {tab === 'colours' ? (
            <ColoursPanel draft={draft} set={set} base={base} setBase={setBase} />
          ) : null}
          {tab === 'sections' ? (
            <SectionsPanel draft={draft} set={set} focus={focus} setFocus={setFocus} />
          ) : null}
          {tab === 'marquee' ? <MarqueePanel draft={draft} set={set} services={services} /> : null}
          {tab === 'season' ? <SeasonPanel draft={draft} set={set} /> : null}
          {tab === 'history' ? (
            <ul className="divide-y divide-line">
              <li className="flex items-center gap-2 px-5 py-3 text-xs text-ink-subtle">
                <History className="size-4" /> Every publish is kept; roll back any time.
              </li>
              {sf.data.versions.length === 0 ? (
                <li className="px-5 py-4 text-sm text-ink-muted">Not published yet.</li>
              ) : null}
              {sf.data.versions.map((v) => (
                <li key={v.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{v.label}</div>
                    <div className="text-xs text-ink-subtle">
                      {dateTime(v.at, tenant.timezone)} · {v.by}
                    </div>
                  </div>
                  {v.live ? (
                    <Badge tone="emerald" dot>
                      Live
                    </Badge>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => rollback.mutate(v.id)}>
                      Roll back
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        <div className="min-w-0 xl:sticky xl:top-24 xl:self-start">
          <div className="mb-3 flex items-center justify-between">
            <Segmented
              value={device}
              onChange={setDevice}
              items={[
                { value: 'phone', label: <Smartphone className="size-4" /> },
                { value: 'tablet', label: <Tablet className="size-4" /> },
                { value: 'desktop', label: <Monitor className="size-4" /> },
              ]}
            />
            <span className="flex items-center gap-1 text-xs text-ink-subtle">
              Live preview <ExternalLink className="size-3" />
            </span>
          </div>
          <div className="flex justify-center rounded-2xl border border-line bg-[radial-gradient(circle_at_top,#eef5f2,transparent_60%)] p-6">
            <div
              className={cn(
                'overflow-hidden bg-white shadow-pop transition-all duration-300',
                device === 'phone' &&
                  'h-[640px] w-[320px] rounded-[2.2rem] border-[10px] border-charcoal',
                device === 'tablet' &&
                  'h-[640px] w-[520px] max-w-full rounded-[1.6rem] border-[10px] border-charcoal',
                device === 'desktop' &&
                  'h-[560px] w-full max-w-[820px] rounded-xl border border-line',
              )}
            >
              <StorePreview
                sf={draft}
                services={services}
                tiers={cat.data?.tiers ?? []}
                wide={device !== 'phone'}
                focus={focus}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
