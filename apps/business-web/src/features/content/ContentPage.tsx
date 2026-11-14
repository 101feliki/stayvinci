import { useState } from 'react';
import { Clapperboard, Eye, Images, Lock, PlayCircle, Radio, Trash2, Upload } from 'lucide-react';
import {
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
} from '@stayvinci/ui';
import { api } from '../../lib/api';
import type { ContentItem } from '../../mock/types';
import { ErrorState, PageSkeleton } from '../../components/common';
import { money } from '../../lib/format';
import { useAction, useTenantQuery } from '../../lib/query';
import { LiveSessionsPanel, ScheduleLiveDialog } from './LiveSessionsPanel';

/** Paid and free content collections (spec §5.4 paid content, §9 gating). */
export function ContentPage() {
  const content = useTenantQuery(['content'], api.content.list);
  const cat = useTenantQuery(['catalogue'], api.catalogue.get);
  const [open, setOpen] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const remove = useAction((id: string) => api.content.remove(id), { success: 'Removed' });

  if (content.error) return <ErrorState error={content.error} />;
  if (!content.data) return <PageSkeleton />;
  const tiers = cat.data?.tiers ?? [];
  const videos = content.data.filter((c) => c.kind !== 'live');

  return (
    <div>
      <PageHeader
        title="Live & content"
        description="Live sessions, videos and galleries for your guests. Video plays through short-lived signed links only for guests entitled to it, so shared links don't work."
        actions={
          <>
            <Button variant="secondary" onClick={() => setOpen(true)}>
              <Upload className="size-4" /> Upload
            </Button>
            <Button onClick={() => setScheduling(true)}>
              <Radio className="size-4" /> Go live / schedule
            </Button>
          </>
        }
      />
      <h2 className="mb-3 text-[13px] font-semibold tracking-wider text-ink-muted uppercase">
        Live sessions
      </h2>
      <LiveSessionsPanel
        items={content.data}
        tiers={tiers}
        onSchedule={() => setScheduling(true)}
      />
      <h2 className="mt-8 mb-3 text-[13px] font-semibold tracking-wider text-ink-muted uppercase">
        Videos and galleries
      </h2>
      {videos.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Clapperboard className="size-5" />}
            title="No content yet"
            description="Upload a video or gallery. It goes through moderation before guests see it."
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {videos.map((c) => (
            <Card key={c.id} className="overflow-hidden">
              <div className="relative flex h-40 items-center justify-center bg-emerald-card text-ivory">
                {c.kind === 'video' ? (
                  <PlayCircle className="size-12 opacity-80" />
                ) : (
                  <Images className="size-12 opacity-80" />
                )}
                <div className="absolute top-3 left-3 flex gap-1.5">
                  {c.moderation === 'pending' ? <Badge tone="amber">In review</Badge> : null}
                  {c.moderation === 'rejected' ? <Badge tone="red">Rejected</Badge> : null}
                </div>
                {c.durationSec ? (
                  <span className="absolute right-3 bottom-3 rounded bg-black/50 px-1.5 py-0.5 text-[11px] tabular-nums">
                    {Math.floor(c.durationSec / 60)}:{String(c.durationSec % 60).padStart(2, '0')}
                  </span>
                ) : (
                  <span className="absolute right-3 bottom-3 rounded bg-black/50 px-1.5 py-0.5 text-[11px]">
                    {c.items} photos
                  </span>
                )}
              </div>
              <div className="p-4">
                <div className="font-semibold">{c.title}</div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {c.price ? <Badge tone="gold">{money(c.price)} one-off</Badge> : null}
                  {c.tierIds.map((t) => (
                    <Badge key={t} tone="plum">
                      <Lock className="size-3" /> {tiers.find((x) => x.id === t)?.name ?? 'Members'}
                    </Badge>
                  ))}
                  {!c.price && !c.tierIds.length ? <Badge tone="emerald">Free</Badge> : null}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-ink-subtle">
                  <span className="flex items-center gap-1">
                    <Eye className="size-3.5" /> {c.views} views
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => remove.mutate(c.id)}
                    aria-label="Remove"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {open ? <UploadDialog tiers={tiers} onClose={() => setOpen(false)} /> : null}
      {scheduling ? (
        <ScheduleLiveDialog tiers={tiers} onClose={() => setScheduling(false)} />
      ) : null}
    </div>
  );
}

function UploadDialog({
  tiers,
  onClose,
}: {
  tiers: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<ContentItem['kind']>('video');
  const [access, setAccess] = useState<'free' | 'paid' | 'members'>('paid');
  const [price, setPrice] = useState('500');
  const [tierIds, setTierIds] = useState<string[]>([]);
  const create = useAction(
    () =>
      api.content.create({
        title,
        kind,
        price: access === 'paid' ? Math.round(Number(price) * 100) : null,
        tierIds: access === 'members' ? tierIds : [],
      }),
    { success: 'Uploaded. It is now in moderation.', onSuccess: onClose },
  );
  return (
    <Dialog
      open
      onOpenChange={(o) => (!o ? onClose() : undefined)}
      title="Upload content"
      description="Files are virus-scanned, transcoded for streaming and reviewed before guests see them."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => create.mutate(undefined)}
            loading={create.isPending}
            disabled={!title}
          >
            Upload
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-line-strong bg-canvas py-8 text-center">
          <Upload className="size-6 text-ink-subtle" />
          <div className="mt-2 text-sm font-medium">Drop a file here</div>
          <div className="text-xs text-ink-subtle">MP4 or images · demo: no file needed</div>
        </div>
        <Field label="Title">
          {(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} />}
        </Field>
        <Segmented
          value={kind}
          onChange={setKind}
          items={[
            { value: 'video', label: 'Video' },
            { value: 'gallery', label: 'Gallery' },
          ]}
        />
        <div>
          <div className="mb-2 text-[13px] font-medium">Who can watch</div>
          <Segmented
            value={access}
            onChange={setAccess}
            items={[
              { value: 'free', label: 'Free' },
              { value: 'paid', label: 'One-off price' },
              { value: 'members', label: 'Members' },
            ]}
          />
        </div>
        {access === 'paid' ? (
          <Field
            label="Price (KES)"
            hint="On iOS and Android, purchases happen on the web store; the app plays content the guest owns."
          >
            {(id) => (
              <Input
                id={id}
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            )}
          </Field>
        ) : null}
        {access === 'members' ? (
          <div className="flex flex-wrap gap-3">
            {tiers.map((t) => (
              <Checkbox
                key={t.id}
                checked={tierIds.includes(t.id)}
                onChange={(v) =>
                  setTierIds((cur) => (v ? [...cur, t.id] : cur.filter((x) => x !== t.id)))
                }
                label={t.name}
              />
            ))}
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
