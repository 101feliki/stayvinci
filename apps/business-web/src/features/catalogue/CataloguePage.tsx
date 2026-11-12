import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Crown, Gift, Package, Pencil, Percent, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import {
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
  Table,
  Tabs,
  Td,
  Textarea,
  Th,
  Tr,
  ServiceVisual,
} from '@stayvinci/ui';
import { api } from '../../mock/api';
import { ServicePicture } from './ServicePicture';
import type { ItemVisibility, Service } from '../../mock/types';
import { useSession } from '../../app/session';
import { ErrorState, PageSkeleton, VisibilityBadge } from '../../components/common';
import { durationLabel, money } from '../../lib/format';
import { VISIBILITY } from '../../lib/states';
import { useAction, useTenantQuery } from '../../lib/query';

type Tab = 'services' | 'units' | 'addons' | 'packages' | 'memberships' | 'products' | 'giftcards';
type Kind =
  | 'services'
  | 'categories'
  | 'addOns'
  | 'packages'
  | 'tiers'
  | 'products'
  | 'giftCards'
  | 'ratePlans';

function VisibilitySelect({ kind, id, value }: { kind: Kind; id: string; value: ItemVisibility }) {
  const set = useAction((v: ItemVisibility) => api.catalogue.setVisibility(kind, id, v), {
    success: 'Visibility updated',
  });
  return (
    <select
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => set.mutate(e.target.value as ItemVisibility)}
      className="rounded-lg border border-transparent bg-transparent py-1 pr-1 text-xs font-medium text-ink-muted hover:border-line focus:border-azure-500 focus:outline-none"
      aria-label="Visibility"
    >
      {(Object.keys(VISIBILITY) as ItemVisibility[]).map((v) => (
        <option key={v} value={v}>
          {VISIBILITY[v].label}
        </option>
      ))}
    </select>
  );
}

export function CataloguePage() {
  const { tenant } = useSession();
  const [params, setParams] = useSearchParams();
  const spa = tenant.vertical === 'spa';
  const tab = (params.get('tab') as Tab | null) ?? (spa ? 'services' : 'units');
  const setTab = (t: Tab) => setParams({ tab: t });
  const cat = useTenantQuery(['catalogue'], api.catalogue.get);
  const team = useTenantQuery(['team'], api.team.list);
  const [editing, setEditing] = useState<Service | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const restock = useAction((id: string) => api.catalogue.restock(id, 10), {
    success: 'Added 10 to stock',
  });

  if (cat.error) return <ErrorState error={cat.error} />;
  if (!cat.data) return <PageSkeleton />;
  const c = cat.data;

  const tabs = [
    ...(spa
      ? [{ value: 'services' as const, label: 'Services', count: c.services.length }]
      : [{ value: 'units' as const, label: 'Units & rates', count: c.ratePlans.length }]),
    { value: 'addons' as const, label: 'Add-ons', count: c.addOns.length },
    ...(spa
      ? [
          { value: 'packages' as const, label: 'Packages', count: c.packages.length },
          { value: 'memberships' as const, label: 'Memberships', count: c.tiers.length },
          { value: 'products' as const, label: 'Products', count: c.products.length },
          { value: 'giftcards' as const, label: 'Gift cards', count: c.giftCards.length },
        ]
      : []),
  ];

  const blank: Service = {
    id: '',
    tenantId: tenant.id,
    categoryId: c.categories[0]?.id ?? '',
    name: '',
    description: '',
    bufferBeforeMin: 0,
    bufferAfterMin: 15,
    requires: ['staff', 'room'],
    variants: [{ id: `v_${Date.now()}`, name: '60 min', durationMin: 60, price: 0 }],
    visibility: 'public',
    staffIds: [],
    taxClass: 'standard',
    image: null,
    icon: 'sparkles',
  };

  return (
    <div>
      <PageHeader
        title="Catalogue"
        description="What guests can book and buy. Price and availability changes apply immediately; storefront layout changes go live when you publish."
        actions={
          tab === 'services' ? (
            <>
              {selected.length ? (
                <Button variant="secondary" onClick={() => setBulkOpen(true)}>
                  <Percent className="size-4" /> Adjust {selected.length} prices
                </Button>
              ) : null}
              <Button onClick={() => setEditing(blank)}>
                <Plus className="size-4" /> New service
              </Button>
            </>
          ) : null
        }
      />
      <Tabs value={tab} onChange={setTab} items={tabs} className="mb-5" />

      {tab === 'services' ? (
        <div className="space-y-5">
          {c.categories.map((category) => {
            const list = c.services.filter((s) => s.categoryId === category.id);
            return (
              <Card key={category.id}>
                <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-semibold">{category.name}</h3>
                    <span className="text-xs text-ink-subtle">{list.length}</span>
                  </div>
                  <VisibilitySelect
                    kind="categories"
                    id={category.id}
                    value={category.visibility}
                  />
                </div>
                <Table>
                  <thead>
                    <tr>
                      <Th className="w-10" />
                      <Th>Service</Th>
                      <Th>Options</Th>
                      <Th className="hidden md:table-cell">Team</Th>
                      <Th>Visibility</Th>
                      <Th className="w-12" />
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((s) => (
                      <Tr key={s.id} className="cursor-pointer" onClick={() => setEditing(s)}>
                        <Td onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected.includes(s.id)}
                            onChange={(v) =>
                              setSelected((cur) =>
                                v ? [...cur, s.id] : cur.filter((x) => x !== s.id),
                              )
                            }
                            label={<span className="sr-only">Select {s.name}</span>}
                          />
                        </Td>
                        <Td>
                          <div className="flex items-center gap-3">
                            <div className="relative size-11 shrink-0 overflow-hidden rounded-lg">
                              <ServiceVisual
                                image={s.image}
                                icon={s.icon}
                                name={s.name}
                                from="#092720"
                                to="#C8A96A"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium">{s.name}</div>
                              <div className="line-clamp-1 max-w-sm text-xs text-ink-subtle">
                                {s.description}
                              </div>
                            </div>
                          </div>
                        </Td>
                        <Td>
                          <div className="flex flex-wrap gap-1">
                            {s.variants.map((v) => (
                              <span
                                key={v.id}
                                className="rounded-md bg-canvas px-1.5 py-0.5 text-xs whitespace-nowrap text-ink-muted ring-1 ring-line"
                              >
                                {durationLabel(v.durationMin)} ·{' '}
                                <span className="font-medium text-ink">{money(v.price)}</span>
                              </span>
                            ))}
                          </div>
                        </Td>
                        <Td className="hidden text-ink-muted md:table-cell">
                          {s.staffIds.length} people
                        </Td>
                        <Td>
                          <VisibilityBadge value={s.visibility} />
                        </Td>
                        <Td>
                          <Pencil className="size-4 text-ink-subtle" />
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </Card>
            );
          })}
        </div>
      ) : null}

      {tab === 'units' ? (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Unit</Th>
                <Th className="text-right">Nightly</Th>
                <Th className="text-right">Weekend</Th>
                <Th className="hidden md:table-cell">Stay length</Th>
                <Th className="hidden text-right lg:table-cell">Cleaning</Th>
                <Th className="hidden text-right lg:table-cell">Damage deposit</Th>
                <Th>Visibility</Th>
              </tr>
            </thead>
            <tbody>
              {c.ratePlans.map((rp) => {
                const unit = team.data?.resources.find((r) => r.id === rp.unitId);
                return (
                  <Tr key={rp.id}>
                    <Td>
                      <div className="font-medium">{unit?.name}</div>
                      <div className="text-xs text-ink-subtle">
                        {rp.name} rate · {unit?.bedrooms} bd · up to {unit?.maxGuests}
                      </div>
                    </Td>
                    <Td className="text-right tabular-nums">{money(rp.nightly)}</Td>
                    <Td className="text-right tabular-nums">{money(rp.weekend)}</Td>
                    <Td className="hidden md:table-cell">
                      {rp.minNights}–{rp.maxNights} nights
                    </Td>
                    <Td className="hidden text-right tabular-nums lg:table-cell">
                      {money(rp.cleaningFee)}
                    </Td>
                    <Td className="hidden text-right tabular-nums lg:table-cell">
                      {money(rp.damageDeposit)}
                    </Td>
                    <Td>
                      <VisibilitySelect kind="ratePlans" id={rp.id} value={rp.visibility} />
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      ) : null}

      {tab === 'addons' ? (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Add-on</Th>
                <Th>Applies to</Th>
                <Th className="text-right">Price</Th>
                <Th className="hidden text-right sm:table-cell">Extra time</Th>
                <Th>Visibility</Th>
              </tr>
            </thead>
            <tbody>
              {c.addOns.map((a) => (
                <Tr key={a.id}>
                  <Td className="font-medium">{a.name}</Td>
                  <Td className="text-ink-muted">{a.appliesTo}</Td>
                  <Td className="text-right tabular-nums">{money(a.price)}</Td>
                  <Td className="hidden text-right sm:table-cell">
                    {a.durationMin ? `+${a.durationMin} min` : '—'}
                  </Td>
                  <Td>
                    <VisibilitySelect kind="addOns" id={a.id} value={a.visibility} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}

      {tab === 'packages' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {c.packages.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="flex items-start justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Package className="size-5" />
                </span>
                <VisibilitySelect kind="packages" id={p.id} value={p.visibility} />
              </div>
              <div className="mt-4 text-[15px] font-semibold">{p.name}</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                {money(p.price)}
              </div>
              <div className="mt-3 space-y-1 text-[13px] text-ink-muted">
                <div>
                  {p.credits} credits · valid {p.validityDays} days
                </div>
                <div>{p.transferable ? 'Transferable' : 'Not transferable'}</div>
                <div className="font-medium text-ink">{p.sold} sold</div>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {tab === 'memberships' ? (
        <div className="grid gap-4 md:grid-cols-3">
          {c.tiers.map((t, i) => (
            <Card key={t.id} className={i === 1 ? 'border-gold-300 ring-1 ring-gold-300' : ''}>
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-plum-50 text-plum-700">
                    <Crown className="size-5" />
                  </span>
                  <VisibilitySelect kind="tiers" id={t.id} value={t.visibility} />
                </div>
                <div className="mt-4 text-[15px] font-semibold">{t.name}</div>
                <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                  {money(t.monthly)}
                  <span className="text-sm font-normal text-ink-muted"> / month</span>
                </div>
                <ul className="mt-4 space-y-1.5 text-[13px]">
                  {t.perks.map((p) => (
                    <li key={p} className="flex gap-2">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gold-400" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-between border-t border-line px-5 py-3 text-[13px]">
                <span className="text-ink-muted">Active members</span>
                <span className="font-semibold">{t.members}</span>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {tab === 'products' ? (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th className="hidden sm:table-cell">SKU</Th>
                <Th className="text-right">Price</Th>
                <Th className="text-right">Stock</Th>
                <Th>Visibility</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {c.products.map((p) => (
                <Tr key={p.id}>
                  <Td>
                    <div className="flex items-center gap-2 font-medium">
                      <ShoppingBag className="size-4 text-ink-subtle" /> {p.name}
                    </div>
                  </Td>
                  <Td className="hidden font-mono text-xs text-ink-muted sm:table-cell">{p.sku}</Td>
                  <Td className="text-right tabular-nums">{money(p.price)}</Td>
                  <Td className="text-right">
                    {p.stock === 0 ? (
                      <Badge tone="red">Out</Badge>
                    ) : p.stock <= p.lowStockAt ? (
                      <Badge tone="amber">{p.stock} left</Badge>
                    ) : (
                      <span className="tabular-nums">{p.stock}</span>
                    )}
                  </Td>
                  <Td>
                    <VisibilitySelect kind="products" id={p.id} value={p.visibility} />
                  </Td>
                  <Td className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => restock.mutate(p.id)}>
                      +10 stock
                    </Button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}

      {tab === 'giftcards' ? (
        <div className="grid gap-4 md:grid-cols-2">
          {c.giftCards.map((g) => (
            <Card key={g.id} className="overflow-hidden">
              <div className="relative h-36 bg-emerald-900 p-5 text-ivory">
                <div className="absolute -right-10 -bottom-16 size-48 rounded-full border border-gold-400/30" />
                <Gift className="size-6 text-gold-300" />
                <div className="mt-6 text-xs tracking-widest text-gold-300 uppercase">
                  {tenant.name}
                </div>
                <div className="text-2xl font-semibold">
                  {g.value ? money(g.value) : 'Any amount'}
                </div>
              </div>
              <div className="flex items-center justify-between px-5 py-3 text-[13px]">
                <span>
                  <span className="font-medium">{g.name}</span>
                  <span className="text-ink-muted">
                    {' '}
                    · valid {g.validityDays} days · {g.sold} sold
                  </span>
                </span>
                <VisibilitySelect kind="giftCards" id={g.id} value={g.visibility} />
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {editing ? <ServiceEditor service={editing} onClose={() => setEditing(null)} /> : null}
      {bulkOpen ? (
        <BulkPrice
          ids={selected}
          onClose={() => {
            setBulkOpen(false);
            setSelected([]);
          }}
        />
      ) : null}
    </div>
  );
}

function ServiceEditor({ service, onClose }: { service: Service; onClose: () => void }) {
  const cat = useTenantQuery(['catalogue'], api.catalogue.get);
  const team = useTenantQuery(['team'], api.team.list);
  const [s, setS] = useState<Service>(service);
  const save = useAction(() => api.catalogue.saveService(s), {
    success: 'Service saved',
    onSuccess: onClose,
  });
  const staff = team.data?.resources.filter((r) => r.type === 'staff') ?? [];
  return (
    <Drawer
      open
      onOpenChange={(o) => (!o ? onClose() : undefined)}
      width="lg"
      title={service.id ? 'Edit service' : 'New service'}
      description="Durations, prices and who can perform it."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate(undefined)} loading={save.isPending}>
            Save service
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Name">
          {(id) => (
            <Input id={id} value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} />
          )}
        </Field>
        <Field label="Description">
          {(id) => (
            <Textarea
              id={id}
              value={s.description}
              onChange={(e) => setS({ ...s, description: e.target.value })}
            />
          )}
        </Field>
        <ServicePicture
          name={s.name}
          image={s.image}
          icon={s.icon}
          onChange={(v) => setS({ ...s, ...v })}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            {(id) => (
              <Select
                id={id}
                value={s.categoryId}
                onChange={(e) => setS({ ...s, categoryId: e.target.value })}
              >
                {cat.data?.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Visibility">
            {(id) => (
              <Select
                id={id}
                value={s.visibility}
                onChange={(e) => setS({ ...s, visibility: e.target.value as ItemVisibility })}
              >
                {(Object.keys(VISIBILITY) as ItemVisibility[]).map((v) => (
                  <option key={v} value={v}>
                    {VISIBILITY[v].label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Buffer before (min)">
            {(id) => (
              <Input
                id={id}
                type="number"
                min={0}
                step={5}
                value={s.bufferBeforeMin}
                onChange={(e) => setS({ ...s, bufferBeforeMin: Number(e.target.value) })}
              />
            )}
          </Field>
          <Field label="Turnover after (min)">
            {(id) => (
              <Input
                id={id}
                type="number"
                min={0}
                step={5}
                value={s.bufferAfterMin}
                onChange={(e) => setS({ ...s, bufferAfterMin: Number(e.target.value) })}
              />
            )}
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-medium">Options and prices</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setS({
                  ...s,
                  variants: [
                    ...s.variants,
                    { id: `v_${Date.now()}`, name: '', durationMin: 60, price: 0 },
                  ],
                })
              }
            >
              <Plus className="size-4" /> Add option
            </Button>
          </div>
          <div className="space-y-2">
            {s.variants.map((v, i) => (
              <div key={v.id} className="grid grid-cols-[1fr_90px_120px_36px] items-center gap-2">
                <Input
                  placeholder="Name (e.g. 90 min)"
                  value={v.name}
                  onChange={(e) =>
                    setS({
                      ...s,
                      variants: s.variants.map((x, j) =>
                        j === i ? { ...x, name: e.target.value } : x,
                      ),
                    })
                  }
                />
                <Input
                  type="number"
                  min={5}
                  step={5}
                  aria-label="Minutes"
                  value={v.durationMin}
                  onChange={(e) =>
                    setS({
                      ...s,
                      variants: s.variants.map((x, j) =>
                        j === i ? { ...x, durationMin: Number(e.target.value) } : x,
                      ),
                    })
                  }
                />
                <Input
                  type="number"
                  min={0}
                  step={100}
                  aria-label="Price in KES"
                  value={v.price / 100}
                  onChange={(e) =>
                    setS({
                      ...s,
                      variants: s.variants.map((x, j) =>
                        j === i ? { ...x, price: Math.round(Number(e.target.value) * 100) } : x,
                      ),
                    })
                  }
                />
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Remove option"
                  onClick={() => setS({ ...s, variants: s.variants.filter((_, j) => j !== i) })}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <div className="grid grid-cols-[1fr_90px_120px_36px] gap-2 px-1 text-[11px] text-ink-subtle">
              <span>Name</span>
              <span>Minutes</span>
              <span>Price (KES)</span>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 text-[13px] font-medium">Who can perform it</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {staff.map((p) => (
              <Checkbox
                key={p.id}
                checked={s.staffIds.includes(p.id)}
                onChange={(on) =>
                  setS({
                    ...s,
                    staffIds: on ? [...s.staffIds, p.id] : s.staffIds.filter((x) => x !== p.id),
                  })
                }
                label={p.name}
                className="rounded-xl border border-line px-3 py-2"
              />
            ))}
          </div>
        </div>
      </div>
    </Drawer>
  );
}

function BulkPrice({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const [pct, setPct] = useState('10');
  const go = useAction(() => api.catalogue.bulkPrice(ids, Number(pct)), {
    success: 'Prices updated',
    onSuccess: onClose,
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => (!o ? onClose() : undefined)}
      title={`Adjust prices for ${ids.length} services`}
      description="Applies to every option of the selected services, rounded to the nearest KES 10. Takes effect immediately."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => go.mutate(undefined)} loading={go.isPending}>
            Apply {Number(pct) > 0 ? '+' : ''}
            {pct}%
          </Button>
        </>
      }
    >
      <Field label="Change by (%)" hint="Use a negative number to lower prices.">
        {(id) => (
          <Input id={id} type="number" value={pct} onChange={(e) => setPct(e.target.value)} />
        )}
      </Field>
    </Dialog>
  );
}
