import { useMemo, useState } from 'react';
import { Send } from 'lucide-react';
import { Button, Checkbox, Dialog, Field, Input, Segmented, Select } from '@stayvinci/ui';
import type { PayMethod, PlanId } from '@stayvinci/demo-data/platform';
import type { Vertical } from '@stayvinci/demo-data/types';
import { api } from '../../mock/api';
import { newIdempotencyKey, useAction } from '../../lib/query';
import { PLAN_LABEL } from '../../lib/labels';

const blank = {
  name: '',
  handle: '',
  kind: 'house' as 'house' | 'atelier',
  vertical: 'spa' as Vertical,
  category: '',
  area: '',
  plan: 'business' as PlanId,
  ownerName: '',
  ownerPhone: '',
  ownerEmail: '',
  payMethod: 'till' as PayMethod | 'none',
  setUpForThem: true,
};

function toHandle(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
}

/**
 * White-glove onboarding (spec §2: "an Operations user sends an invite link").
 * Creates the House as Invited and sends the owner an invite by SMS and email.
 * Houses can also sign up on their own; this is for the ones we bring in.
 */
export function NewHouseDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const [f, setF] = useState(blank);
  const [handleTouched, setHandleTouched] = useState(false);
  const key = useMemo(() => (open ? newIdempotencyKey() : ''), [open]);
  const set = <K extends keyof typeof blank>(k: K, v: (typeof blank)[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  const create = useAction(
    () => api.tenants.create({ ...f, payMethod: f.payMethod === 'none' ? null : f.payMethod }, key),
    {
      success: (t) => `Invite sent to ${t.owner.name}`,
      onSuccess: (t) => {
        onOpenChange(false);
        setF(blank);
        setHandleTouched(false);
        onCreated(t.id);
      },
    },
  );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Add a House"
      description="We create the account and send the owner an invite. They set their own password and two-step verification, then accept the agreements themselves."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button loading={create.isPending} onClick={() => create.mutate(undefined)}>
            <Send className="size-4" /> Create and send invite
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Segmented
          value={f.kind}
          onChange={(v) => set('kind', v)}
          items={[
            { value: 'house', label: 'House (business)' },
            { value: 'atelier', label: 'Atelier (independent pro)' },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name">
            {(id) => (
              <Input
                id={id}
                value={f.name}
                onChange={(e) => {
                  set('name', e.target.value);
                  if (!handleTouched) set('handle', toHandle(e.target.value));
                }}
                placeholder="Jasiri Fitness & Spa"
              />
            )}
          </Field>
          <Field label="Handle" hint="Becomes the private code and web address">
            {(id) => (
              <Input
                id={id}
                value={f.handle}
                onChange={(e) => {
                  setHandleTouched(true);
                  set('handle', e.target.value.toLowerCase());
                }}
                placeholder="jasiri"
              />
            )}
          </Field>
          <Field label="Type of business">
            {(id) => (
              <Select
                id={id}
                value={f.vertical}
                onChange={(e) => set('vertical', e.target.value as Vertical)}
              >
                <option value="spa">Spa, salon, lounge or wellness</option>
                <option value="short_stay">Short stays</option>
              </Select>
            )}
          </Field>
          <Field label="Category" hint="e.g. Spa, Hair, Nails, Massage therapist">
            {(id) => (
              <Input id={id} value={f.category} onChange={(e) => set('category', e.target.value)} />
            )}
          </Field>
          <Field label="Area">
            {(id) => (
              <Input
                id={id}
                value={f.area}
                onChange={(e) => set('area', e.target.value)}
                placeholder="Kilimani, Nairobi"
              />
            )}
          </Field>
          <Field label="Plan" hint="Prices aren't set yet; you can change the plan any time">
            {(id) => (
              <Select
                id={id}
                value={f.plan}
                onChange={(e) => set('plan', e.target.value as PlanId)}
              >
                {(Object.keys(PLAN_LABEL) as PlanId[]).map((p) => (
                  <option key={p} value={p}>
                    {PLAN_LABEL[p]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <div className="border-t border-line pt-5">
          <div className="mb-3 text-sm font-semibold">Owner</div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Full name">
              {(id) => (
                <Input
                  id={id}
                  value={f.ownerName}
                  onChange={(e) => set('ownerName', e.target.value)}
                />
              )}
            </Field>
            <Field label="Mobile number">
              {(id) => (
                <Input
                  id={id}
                  inputMode="tel"
                  value={f.ownerPhone}
                  onChange={(e) => set('ownerPhone', e.target.value)}
                  placeholder="+254 7…"
                />
              )}
            </Field>
            <Field label="Email" hint="For invoices">
              {(id) => (
                <Input
                  id={id}
                  type="email"
                  value={f.ownerEmail}
                  onChange={(e) => set('ownerEmail', e.target.value)}
                />
              )}
            </Field>
          </div>
        </div>

        <div className="border-t border-line pt-5">
          <div className="mb-1 text-sm font-semibold">How they take M-Pesa</div>
          <p className="mb-3 text-[13px] text-ink-muted">
            The owner enters their own Daraja keys on a secure screen; Stayvinci staff never see
            them.
          </p>
          <Segmented
            value={f.payMethod}
            onChange={(v) => set('payMethod', v)}
            items={[
              { value: 'till', label: 'Till (Buy Goods)' },
              { value: 'paybill', label: 'Paybill' },
              { value: 'none', label: 'Not sure yet' },
            ]}
          />
        </div>

        <div className="rounded-xl border border-gold-200 bg-gold-50 p-4">
          <Checkbox
            checked={f.setUpForThem}
            onChange={(v) => set('setUpForThem', v)}
            label={
              <span>
                <span className="font-medium">We&apos;ll set up the store for them</span>
                <span className="block text-[13px] text-ink-muted">
                  Assigns you as onboarding manager. You can open their business app from the House
                  page and add services, staff and hours.
                </span>
              </span>
            }
          />
        </div>
      </div>
    </Dialog>
  );
}
