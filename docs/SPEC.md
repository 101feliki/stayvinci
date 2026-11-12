# Stayvinci — Product Requirements & System Specification

Nov 8, 2026 · Felix Kariuki

## 0. Purpose, scope and conventions

This specification tells product, design and engineering exactly what Stayvinci does, stage by stage along the core workflow, and what every admin surface contains.

**Scope (v1):** multi-tenant platform for Houses (spas, lounges, short-stay hosts) and Ateliers (verified independent professionals), a guest marketplace app, a business app, and a platform admin console. Kenya first; every country-specific rule (payments, tax, compliance) sits behind a configurable **market** so new countries can be added without code forks.

**Out of scope (v1):** pricing amounts (decided later), white-label app builds (Signature tier, v2), POS hardware, payroll, inventory beyond simple stock counts.

**How to read this spec:** sections 2–12 follow the workflow in order (join → pay setup → verify → set up → open door → guest app → discovery → store → book and pay → visit and return → platform earns). Each stage lists **what it entails**, **how it works**, **states**, **rules** and **edge cases**. Sections 13–15 describe every admin and app surface. Sections 16–22 cover cross-cutting systems.

**Requirement keywords:** MUST = required for launch; SHOULD = strongly expected, may slip one release; MAY = optional.

### Glossary

| Term             | Meaning                                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| Platform         | Stayvinci itself: the company, its admin console and shared services                                                  |
| Market           | A country configuration: currency, payment rails, tax and compliance rules, languages                                 |
| Tenant           | One paying account on the platform; a House or an Atelier                                                             |
| House            | A business tenant: spa, lounge, salon, studio or short-stay operator; may have several locations, staff and resources |
| Atelier          | A single verified independent professional tenant; one resource (themselves)                                          |
| Guest            | An end client who books Houses and Ateliers through the guest app or web                                              |
| Store            | A tenant's curated, branded space inside Stayvinci                                                                    |
| Resource         | Anything bookable: a staff member, room, chair, unit, or the Atelier themself                                         |
| Offering         | Anything a guest can buy: service, unit stay, product, package, membership, paid content                              |
| Booking mode     | `slot` (time-based, e.g. 60-minute massage) or `night` (date-based, e.g. 3-night stay)                                |
| Access code      | A private code or link that admits a guest to a private store                                                         |
| Attribution      | The record of how a guest first arrived at a tenant: own channel or marketplace                                       |
| Marketplace fee  | Platform fee charged only on a guest's first booking attributed to marketplace discovery                              |
| Merchant account | The tenant's own payment receiving account (M-Pesa Paybill/Till, card gateway, PayPal)                                |

## 1. Actors, roles and permissions

Access is role-based with per-person overrides; every permission check happens on the server and is scoped to one tenant.

### Platform roles (Stayvinci staff)

Decided 2026-11-10 (ADR 0004): four console roles to start, mirroring the business side. Trust & safety and Support MAY be split out later.

| Role        | Can do                                                                                                                                                                                                                                                    | Cannot do                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Super admin | Everything: plans and entitlements, feature releases, staff accounts, markets, plus all Admin, Finance and Marketing actions                                                                                                                              | View decrypted payment credentials or guest ID documents without a logged break-glass reason |
| Admin       | Create and invite tenants, change tenant state, change a tenant's plan, set per-tenant feature overrides, add pilot testers to beta features, **set up and edit a tenant's store on its behalf (assist mode)**, view transactions and insights, audit log | Change the plan catalogue, release stages or staff accounts                                  |
| Finance     | Subscriptions, invoices, coupons, grace periods, marketplace-fee ledger, transaction data and exports, insights                                                                                                                                           | Store edits, feature releases                                                                |
| Marketing   | Marketplace listings and featured Houses, categories, growth insights                                                                                                                                                                                     | Billing, store edits, transaction-level data                                                 |

**Pilot control (assist mode).** During the pilot, Super admins and Admins MAY open any tenant's business app with full owner capabilities to set up or fix the store remotely, without a per-session consent step. Safeguards that always apply: the session is labelled "Stayvinci support (name)" in a visible banner; every change is written to the tenant's own audit log under that name; assist sessions never see decrypted payment credentials; legal agreements are accepted only by the owner; M-Pesa credentials are entered only by the owner.

### Tenant roles (inside a House)

| Role           | Typical person              | Default permissions                                                                                                                     |
| -------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Owner          | Business owner              | Everything in the tenant, including billing, payment accounts, roles, data export, closing the account. At least one owner MUST exist   |
| Manager        | Spa or property manager     | Catalogue, schedules, bookings, staff, content, reports; no billing, no payment credentials, no data export                             |
| Front desk     | Receptionist                | Create, move and cancel bookings, check guests in, take payments; sees guest names and booking notes only, **never** phone, email or ID |
| Practitioner   | Therapist, stylist, cleaner | Own schedule and own bookings only; guest first name and service notes                                                                  |
| Content editor | Marketing person            | Storefront, media, paid content; no bookings or guests                                                                                  |
| Accountant     | External bookkeeper         | Read-only financial reports and exports; no guest data                                                                                  |

Ateliers have a single **Owner** role; they MAY invite one assistant with Front desk permissions.

### Guest

A guest has one global Stayvinci identity and a separate, tenant-scoped **guest profile** inside each store they use. Tenants never see a guest's activity in other stores.

### Permission rules

- Permissions are a set of named capabilities (e.g. `booking.create`, `guest.contact.view`, `payment_account.manage`, `report.financial.view`). Roles are bundles; owners MAY add or remove single capabilities per person.
- `guest.contact.view` and `guest.export` are off for every role except Owner by default; this is the anti-poaching guarantee and MUST be enforced in API responses (fields omitted, not merely hidden in the UI).
- Every privileged action writes an audit log entry: actor, tenant, action, target, before/after, IP, timestamp.
- Platform staff impersonation and assist sessions MUST be visible to the tenant in its audit log, attributed to "Stayvinci support (name)".

## 2. Stage 1a: Joining — plan, agreement, account

A prospective House or Atelier goes from the marketing website to a live, empty tenant with a chosen plan and signed agreements.

### What it entails

- Choosing a tenant type (House or Atelier) and vertical (spa/lounge, short-stay, Atelier category).
- Choosing a plan (Solo, Business, Signature) and billing interval (monthly or annual).
- Creating the owner account and the tenant.
- Accepting the legal agreements.
- Paying the first subscription charge and, where applicable, the setup fee.

### How it works

1. **Entry:** owner clicks a plan on the website, or an Operations user sends an invite link (white-glove sales). Invite links carry a pre-filled plan, discount and assigned onboarding manager.
2. **Owner account:** phone number (OTP) plus email (verification link), full legal name, password or passkey. Phone is the primary identifier in Kenya; email is required for invoices.
3. **Tenant record:** business display name, legal name, tenant type, vertical, market (country), primary city, time zone, currency (from market), preferred handle (becomes the private code and subdomain, e.g. `serenity` → `serenity.stayvinci.com`). Handles are unique, 3–30 characters, lowercase letters, digits and hyphens, with a reserved-word list.
4. **Plan selection:** plan, interval, add-ons (Signature only for now). Prices are read from the plan catalogue (managed in the platform console), never hard-coded. Self sign-up is open: a business can join and start setting up without Stayvinci staff; sensible defaults are applied everywhere and can be changed later.
   - Optional: "Roughly what does the business earn per month today?" (a range). Used only for the platform's growth insights (section 13), never shown to guests.
5. **Agreements:** the owner MUST accept, as separate checkboxes with versioned links: Terms of Service, Data Processing Agreement (Stayvinci as processor, tenant as controller), Content and Conduct Policy, and for short-stay tenants the Short-Stay Addendum. Store: document ID, version, acceptance timestamp, IP, user agent, owner user ID.
6. **First payment:** subscription charged to the owner's chosen method (M-Pesa STK push or card). This is Stayvinci's own merchant account, completely separate from the tenant's future merchant accounts.
7. **Result:** tenant status becomes `onboarding`. Owner lands in the business app's setup checklist.

### Tenant lifecycle states

| State                  | Meaning                                | Guests can book?                                    |
| ---------------------- | -------------------------------------- | --------------------------------------------------- |
| `onboarding`           | Paid, setting up                       | No                                                  |
| `pending_verification` | Submitted documents, awaiting review   | No                                                  |
| `ready`                | Verified and set up, not yet published | No (owner can preview)                              |
| `live`                 | Published                              | Yes                                                 |
| `past_due`             | Subscription unpaid, in grace period   | Yes, with owner warnings                            |
| `suspended`            | Unpaid after grace, or policy breach   | No; store shows a neutral "unavailable" page        |
| `closed`               | Owner closed the account               | No; data retained per retention policy then deleted |

### Rules and edge cases

- Design partners and promotions are applied through **coupons** on the subscription (percentage, fixed or free months), created by Finance.
- If the first payment fails, the tenant is created in `onboarding_unpaid` and the checklist shows a payment step first; no store setup until paid.
- Agreements are versioned. When a new version is published, owners MUST re-accept at next login before continuing; Finance can set a deadline after which the tenant moves to `suspended`.
- One person MAY own several tenants (e.g. a spa and a short-stay business) and switches between them in the business app.
- Plan changes: upgrades apply immediately with proration; downgrades apply at the next renewal and are blocked if current usage exceeds the lower plan's limits (staff count, locations, resources).

## 3. Stage 1b: Own payments — connecting merchant accounts

Every tenant receives guest money directly into its own accounts; Stayvinci orchestrates payments but never holds guest funds.

### What it entails

- Connecting one or more **payment providers** per tenant: M-Pesa (Paybill or Till via Daraja), a card gateway (e.g. Pesapal, Flutterwave, Paystack, DPO — one chosen for v1), PayPal (SHOULD), crypto through a licensed processor (MAY, later).
- Storing credentials securely.
- Proving the connection works with a live test transaction.
- Receiving payment confirmations (callbacks/webhooks) and matching them to bookings.
- Handling refunds and reconciliation.

### How it works

1. **Provider picker:** owner sees providers enabled for their market. Each provider has a connection form generated from a provider definition (fields, validation, help text).
2. **M-Pesa (Daraja) fields:** shortcode type (Paybill or Buy Goods Till), shortcode, Lipa na M-Pesa passkey, consumer key, consumer secret, account reference format (Paybill only), environment (production). Where the tenant has no Daraja app, Operations follows a guided process to obtain one; this is part of white-glove onboarding.
3. **Card gateway fields:** per provider (e.g. merchant ID, API keys, webhook secret). Prefer gateways with OAuth or sub-merchant onboarding so the tenant never pastes secrets.
4. **Credential vault:** secrets are encrypted with envelope encryption (per-tenant data key, wrapped by a KMS master key). Only the payments service can decrypt; the business app and admin consoles only ever see masked values (last 4 characters). Rotations and views are audit-logged.
5. **Test transaction:** owner triggers a small test charge to their own phone or card; the provider must confirm through the callback within a timeout. Success marks the provider `verified`. The amount is refunded or reversed where the provider supports it.
6. **Default provider:** owner chooses which providers are offered to guests and in what order.
7. **M-Pesa for every House (decided 2026-11-10).** Most Kenyan businesses take M-Pesa through a Paybill or a Till (Buy Goods), so every tenant gets M-Pesa as a core feature in one of two modes:
   - **Automatic (Daraja):** STK push to the guest plus C2B confirmation; bookings confirm by themselves. Uses `CustomerPayBillOnline` for Paybills and `CustomerBuyGoodsOnline` for Tills.
   - **Manual:** for tenants without Daraja access yet. The guest pays the shortcode with the booking reference; front desk confirms the payment (with the M-Pesa transaction code) and the booking confirms. The provider is `verified` once the shortcode is confirmed by the owner. Unmatched payments still land in the unmatched queue.

### Payment provider states

`draft` → `testing` → `verified` → (`disabled` | `failing`). A tenant cannot go `live` without at least one `verified` provider.

### Payment flow (per transaction)

1. Booking engine creates a **payment intent**: tenant, guest, amount, currency, purpose (`deposit`, `balance`, `package`, `membership`, `content`, `product`, `damage_deposit`), idempotency key, expiry.
2. Payments service calls the provider using the tenant's credentials (e.g. STK push to the guest's phone).
3. Provider sends a callback to `https://pay.stayvinci.com/callbacks/{provider}/{tenant_connection_id}`. The callback is authenticated (signature, IP allow-list where available), stored raw, and processed idempotently.
4. Intent moves `pending` → `succeeded` | `failed` | `expired` | `cancelled`. A reconciliation job queries the provider for any intent still pending after its timeout, so missed callbacks never leave a booking stuck.
5. On success, a **ledger entry** is written (see section 12) and the booking is confirmed.

### Neutral descriptors

Where the provider allows it, the account reference and description shown on the guest's statement MUST be neutral (e.g. `SV-7F3K2`), never the service name. Tenants MAY override with their business name.

### Marketplace fee collection

Because money lands with the tenant, the marketplace fee is **invoiced to the tenant** monthly (section 12) by default. Where a gateway supports split payments, the platform MAY take the fee at source instead; this is a per-market setting.

### Refunds

- Initiated from the business app by roles with `payment.refund`; full or partial; reason required.
- M-Pesa refunds use the provider's reversal or B2C flow where the tenant has it enabled; otherwise the system records a **manual refund** with proof (transaction code) entered by the tenant.
- Card refunds go through the gateway API.
- Refund state is tracked on the payment and shown to the guest.

### Reconciliation

- Daily job pulls provider statements or transaction lists where APIs allow and matches by provider transaction ID and amount.
- Unmatched incoming payments (e.g. a guest paid the Paybill manually) appear in an **unmatched payments** queue for the tenant to attach to a booking.
- Mismatches (amount differs, duplicate payment) raise alerts in the tenant's finance view.

### Edge cases

- Guest pays twice: second payment flagged as duplicate; tenant is prompted to refund or apply as credit.
- Callback arrives after the intent expired: payment is accepted, booking is re-confirmed if the slot is still free, otherwise auto-flagged for refund.
- Provider credentials revoked: provider moves to `failing`, owner alerted by SMS, email and in-app; booking checkout hides that provider.
- Cash at the counter: front desk MAY record a cash payment against a booking; it is ledgered as `offline` and excluded from provider reconciliation.

## 4. Stage 2a: Verification

Every tenant is verified before going live; requirements differ by tenant type and vertical and are configured per market.

### Requirements by tenant type (Kenya defaults)

| Tenant                     | Documents                                                                                                                                        | Checks                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| House (spa, lounge, salon) | Business registration certificate, KRA PIN certificate, county business permit, owner ID                                                         | Names match across documents; owner ID matches account holder          |
| House (short-stay)         | All of the above plus Tourism Regulatory Authority registration or licence, proof of right to let each unit (title, lease with landlord consent) | Licence number valid and not expired; units listed match the documents |
| Atelier                    | National ID or passport, live selfie, professional certificate or verifiable portfolio, one service category per certificate                     | Selfie matches ID photo; certificate matches the categories requested  |

Requirements live in a **verification template** per market, tenant type and vertical, editable by Super admins, so rules can change without a release.

### How it works

1. Owner uploads documents in the business app's verification step; each file is virus-scanned, stored encrypted, and linked to a requirement.
2. Atelier selfie uses a liveness check (turn head, blink) through an identity-verification provider; the provider returns a match score.
3. Submission moves the tenant to `pending_verification` and creates a case in the platform **verification queue**.
4. A Trust & safety or Operations reviewer opens the case, sees every document side by side, and records a decision per requirement: `accepted`, `rejected` (with reason), or `more_info`.
5. Outcome:
   - All accepted → tenant `ready`; verified badge issued; owner notified.
   - Any `more_info` → owner notified with exact items to fix; case reopens on resubmission.
   - Rejected → owner notified with reason; appeal allowed once.
6. Target: decision within 48 hours of complete submission (SLA tracked in the console).

### Ongoing verification

- Documents with expiry dates (permits, TRA licences) are tracked; owners get reminders 30, 14 and 3 days before expiry. Expired mandatory documents move the tenant to `past_due_compliance`, a warning state; after a grace period set per market, the affected units or services are hidden.
- Adding a new Atelier category requires a new certificate and a new review.
- Adding a short-stay unit requires proof of right to let before the unit can be published.

### Data handling

Identity documents are the most sensitive data in the system: encrypted at rest with a separate key, viewable only by verification reviewers, every view logged, and deleted after a retention period defined in the privacy policy (keep only the decision, reviewer and document metadata).

## 5. Stage 2b: Store setup

The tenant builds its store: identity, locations, resources, catalogue, availability, rules and content. Everything configured here renders identically on web and in the apps.

### 5.1 Setup checklist

The business app shows a checklist that gates publishing. Required items: business profile, at least one location (Houses) or service area (Ateliers), at least one bookable offering, at least one resource with availability, a verified payment provider, cancellation policy, verification approved. Optional items show as recommendations.

### 5.2 Brand and storefront

| Setting             | Detail                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Identity            | Display name, logo (square and wide), cover image or cover video, short tagline, long description                                                                                                                                                                                                                                                                                    |
| Theme               | Choice of curated themes; primary and accent colour from a constrained palette that guarantees text contrast; font pair from a curated list                                                                                                                                                                                                                                          |
| Sections            | Ordered, toggleable blocks: hero, featured offerings, menu by category, team, gallery, video reel, memberships, reviews, policies, location and hours, FAQ                                                                                                                                                                                                                           |
| Domain              | Subdomain `{handle}.stayvinci.com` by default; custom domain on eligible plans (CNAME, automatic TLS)                                                                                                                                                                                                                                                                                |
| Contact             | Shown or hidden; when hidden, guests can only use in-app chat                                                                                                                                                                                                                                                                                                                        |
| Preview             | Live preview on phone, tablet and desktop frames before publishing                                                                                                                                                                                                                                                                                                                   |
| Cover               | Editorial store landing: a full-screen photo (campaign style), a photo beside the text, or brand colour only; headline, subline and button label. The store's top bar floats over a full-screen cover and turns solid on scroll                                                                                                                                                      |
| Service pictures    | Every service shows the House's own photo, a photo from the Stayvinci library, or an icon from the Stayvinci icon set on the store's colours, so stores look finished from day one                                                                                                                                                                                                   |
| Social accounts     | Connect Instagram, Facebook, X, TikTok and WhatsApp Business (OAuth in production). Per account: show on store, and for Instagram/Facebook a "Book" action button pointing at the store. A copyable booking link for bios. WhatsApp opens a chat without exposing the number to staff                                                                                                |
| Logo                | Square logo upload (resized on upload). Shown in the store top bar and hero, on the guest's My places card and in the business app's House switcher. The dominant colour of the logo seeds suggested palettes                                                                                                                                                                        |
| Colour mixes        | Curated palettes plus six generated "mixes" from any starting colour or the logo (deep & gold, tonal, bold contrast, warm, light & airy, noir). Text and button colours are chosen automatically to pass WCAG AA (4.5:1); fine-tuning keeps that guarantee                                                                                                                           |
| Section backgrounds | Each section can be plain, soft tint, brand colour, highlight colour, a CSS texture (silk, candle glow, marble, linen, ripples, arches, dusk) painted from the palette, or an uploaded photo with an adjustable darkening overlay for readable text                                                                                                                                  |
| Marquee             | Optional moving strip under the store's top bar with lines of four kinds: discount/offer, promoted service (tappable, opens the service), message, and the active season's greeting. Speed (slow/normal/fast) and colours (highlight, brand, season). Pauses on hover/focus; still and scrollable for guests who prefer reduced motion                                               |
| Seasonal themes     | New Year, Valentine's Day, Easter, Eid, Mother's Day, Madaraka Day, Mashujaa Day, Halloween, Jamhuri Day, Christmas. Off, one chosen theme, or Automatic (each theme shows only in its date window). Adds subtle decorations to the hero (national days use a Kenyan-flag ribbon) and can tint the highlight colour. Decorations never block taps and are hidden from screen readers |

All media goes through the upload pipeline: virus scan, image resizing to standard renditions, video transcoding to adaptive streaming, and the moderation queue (section 17) before public display.

### 5.3 Locations and resources

- **Location** (Houses): name, address, map pin, opening hours, holiday closures, time zone, photos, arrival instructions (can be released only after payment).
- **Service area** (Ateliers): working base (approximate area shown publicly, exact address released after payment) and travel zones with optional travel fees and travel buffers.
- **Resource types:** `staff`, `room`, `equipment`, `unit` (short-stay), `self` (Atelier). Each resource has a location, a working schedule, skills or capabilities, capacity (e.g. couples room = 2), and visibility (shown to guests or internal).
- **Staff profiles:** display name, photo, bio, specialties, languages, gender (optional, for guest preference), whether guests can choose them.
- **Units (short-stay):** type, bedrooms, beds, bathrooms, maximum guests, amenities, house rules, check-in and check-out times, photos and tour video, TRA licence link.

### 5.4 Catalogue

| Entity                     | Fields and behaviour                                                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Category                   | Name, description, image, order, visibility                                                                                                                                           |
| Service (slot mode)        | Name, description, media, category, duration, buffer before/after, required resources (e.g. 1 therapist + 1 room), capacity, booking rules override, visibility, tax class            |
| Variant                    | Name (e.g. 60 min, 90 min, couples), duration, price, resource requirements override                                                                                                  |
| Unit offering (night mode) | Unit, rate plans (base nightly rate, weekend rate, seasonal rates by date range, length-of-stay discounts), minimum and maximum nights, extra-guest fee, cleaning fee, damage deposit |
| Add-on                     | Name, price, duration impact, applies to which services or units, stock-limited or unlimited                                                                                          |
| Package                    | Bundle of N credits for one or more services, price, validity period, transferable or not                                                                                             |
| Membership                 | Tiers with monthly or annual price, included credits per period, discount on other offerings, priority booking window, members-only access to offerings and content, rollover rules   |
| Product                    | Retail item: name, SKU, price, stock count, low-stock alert, pickup at visit or delivery (delivery MAY, later)                                                                        |
| Paid content               | Video or image collection, preview, price (one-off) or included in a membership tier                                                                                                  |
| Gift card                  | Fixed or custom value, validity, redeemable on chosen offerings                                                                                                                       |

Prices are tenant-defined. Tax: each offering has a tax class; market config defines whether prices are tax-inclusive and the rates (e.g. VAT, tourism levy for short-stay).

### 5.5 Availability

- Each resource has a weekly schedule plus date-specific exceptions (leave, closures, extra hours).
- **Slot mode:** bookable start times are generated from the intersection of all required resources' availability, the service duration plus buffers, and the slot interval (e.g. every 15 minutes). Lead time and booking horizon limit the window.
- **Night mode:** a unit is available per night; external calendars (Airbnb, Booking.com) are imported by iCal every 15 minutes and block dates; Stayvinci bookings are exported as an iCal feed per unit.
- Manual blocks: staff break, maintenance, owner stay.

### 5.6 Booking rules and policies

| Rule               | Options                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| Payment at booking | None, fixed deposit, percentage deposit, full prepayment                                                       |
| Balance            | Pay at venue, auto-charge request before visit, pay in app after visit                                         |
| Cancellation       | Free until X hours/days before; after that, deposit kept, percentage fee, or full charge                       |
| No-show            | Deposit forfeited; optional fee request                                                                        |
| Lead time          | Minimum notice (e.g. 3 hours); maximum horizon (e.g. 90 days)                                                  |
| Who can book       | Anyone in store, returning guests only, members only, invite-code holders only                                 |
| Approval           | Instant confirm or request-to-book (tenant approves within a set window, otherwise auto-declined and refunded) |
| Guest limits       | Max bookings per guest per day; max party size                                                                 |
| Short-stay         | Minimum age, ID required at check-in, damage deposit hold and release rules                                    |

Rules can be set at tenant level and overridden per category, service or unit. The effective rule is resolved most-specific-first and shown to guests in plain language before payment.

### 5.7 Visibility of each item

Every category, offering, content item and staff profile has visibility: `public`, `members_only` (optionally specific tiers), `invite_only` (tied to one or more access codes), `hidden`. Hidden items remain bookable by staff from the business app (e.g. internal or phone bookings).

### 5.8 Publishing

When the checklist is complete and verification is approved, the owner presses **Publish**. The tenant moves to `live`; a version snapshot of the storefront is kept so a broken change can be rolled back. Later edits to the storefront save as drafts and go live on **Publish changes**; catalogue price and availability edits apply immediately.

## 6. Stage 3: Opening the door

The tenant decides who can find its store and gives its existing guests a way in.

### Visibility modes

| Mode                | Discoverable in marketplace?                         | How guests enter                                          |
| ------------------- | ---------------------------------------------------- | --------------------------------------------------------- |
| `private` (default) | No; never appears in search, maps or recommendations | Access code, invite link, QR code                         |
| `listed`            | Yes, in search and category browsing                 | Any of the above, plus marketplace                        |
| `listed_limited`    | Yes, but only the profile page; menu needs a code    | Profile visible; booking requires code or request-to-join |

### Access codes and links

- **Primary code:** the tenant handle (e.g. `SERENITY`), case-insensitive.
- **Additional codes:** tenants MAY create named codes for campaigns or tiers (e.g. `VIP26`), each with optional expiry, usage limit, and the visibility scope it unlocks (whole store, or specific `invite_only` items).
- **Invite links:** `https://stayvinci.com/i/{code}`; single-use personal invites MAY be generated for one guest's phone number.
- **QR codes:** generated per code in print-ready PNG and SVG with the tenant's logo in the centre; reception cards and table tents downloadable from the business app.
- Codes and links are **attribution sources** (section 8): every guest who enters through them is attributed to the tenant's own channel.
- Revoking a code stops new entries; guests already admitted keep access unless the tenant removes them.

### Deep linking

- Links open the guest app directly at the store when installed (universal links on iOS, app links on Android).
- When not installed, the link opens the web store immediately; a dismissible banner offers the app. A deferred deep link carries the code through install so the first app launch opens the right store.

### Marketplace listing

- Listed profile shows: name, cover, category, area (not exact address), rating, starting price ("from" price, tenant can hide), verified badge, next available slot.
- **Ranking** (v1): relevance to query and category, distance, rating with a minimum review count, availability in the requested window, profile completeness. No paid placement in v1.
- Tenants can switch modes at any time; switching to `private` removes the store from search within minutes.

### Guest admission records

Entering a private store creates a **membership-of-store** record (guest ↔ tenant) with entry source, code used and timestamp. Tenants see their admitted guests in their CRM; they MAY remove a guest, which revokes access and cancels future bookings per policy.

## 7. Stage 4: Guest gets the app

Guests use one Stayvinci identity across the Android app, iOS app and web, with discretion built into every touchpoint.

### Channels

| Channel                                    | Notes                                                                                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Web (`stayvinci.com` and store subdomains) | Full browsing, booking and payment; no install needed. MUST work well on low-end Android browsers and slow connections |
| Android app                                | Primary app channel in Kenya                                                                                           |
| iOS app                                    | Required for the premium segment; same features as Android                                                             |

One codebase (React Native for apps, React for web) shares the API and design system.

### Account and authentication

- **Browse without an account:** public store pages and listed profiles are viewable signed out; private stores require a code but not an account to view.
- **Account needed to book.** Sign-up: phone number + OTP (SMS, WhatsApp fallback). Optional email for receipts. Optional Google or Apple sign-in on top.
- **Profile:** first name (required), last name (optional), preferred name or alias, profile photo (optional), date of birth (optional, needed only for age-restricted offerings), preferences (therapist gender, allergies and notes — stored per store, shared with a store only when the guest books there).
- **Sessions:** short-lived access tokens with refresh tokens; device list with remote sign-out; optional app lock (biometric or PIN) for discretion.

### Discretion features

| Feature              | Behaviour                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Neutral app identity | Neutral app name and icon option on the home screen                                                                                        |
| Lock-screen privacy  | Push notifications never name the service or store by default ("Your appointment is confirmed"); guest MAY opt into detailed notifications |
| Alias booking        | Guest MAY book under an alias; the store sees the alias, the platform keeps the real identity for safety and disputes                      |
| Hidden history       | Guest MAY hide a store from their "My places" list and history                                                                             |
| Data control         | Download my data; delete account (with retention exceptions for payments and disputes)                                                     |

### Guest home (signed in)

- **My places:** stores the guest has entered, ordered by recent use.
- **Upcoming:** next bookings with countdown, directions (released after payment), reschedule and cancel actions.
- **Wallet:** packages and credits remaining, active memberships, gift cards, saved payment methods (tokenised by the gateway, never stored raw).
- **Enter a code** field always visible.
- **Discover:** marketplace browsing (section 8).

## 8. Stage 5: Finds the House

Guests reach a store by code, link or marketplace browsing; the system records which one, because that decides whether a marketplace fee ever applies.

### Entry paths

| Path               | Flow                                                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Code               | Guest types a code → system resolves it to a tenant (and scope) → store opens                                                           |
| Link or QR         | Opens store directly (app or web), code applied automatically                                                                           |
| Marketplace search | Query by name, service or area → results list and map → listed profile → store                                                          |
| Category browse    | Spas, massages, facials, short stays, makeup, nails, etc. → filters (area, price band, rating, availability date, at home vs in studio) |

Search MUST never return `private` stores, even for an exact name match; it MAY say "No public listing found — have a code?".

### Attribution rules

1. The first time a guest enters a tenant's store, an **attribution record** is created: `own_channel` (code, invite link, QR, tenant's custom domain, tenant-shared link) or `marketplace` (search, browse, recommendation, platform marketing).
2. Attribution is **permanent per guest–tenant pair**. A guest first brought by the tenant is the tenant's guest forever; no fee ever applies to them.
3. A `marketplace` guest generates a marketplace fee only on their **first completed booking** with that tenant. All later bookings are fee-free.
4. If a guest's first booking is cancelled or refunded in full, the fee is voided and becomes due on the next completed booking instead.
5. Tie-break: if a guest arrives via marketplace and later uses the tenant's code before booking, the **first touch** wins (marketplace). The tenant sees this explained in the fee dashboard.
6. Imported guests: tenants MAY import their existing client list (name and phone). Imported phones are pre-attributed `own_channel`, so if those people later find the store through the marketplace, no fee applies. Imports require the tenant to confirm it has a lawful basis to contact those people.

The fee dashboard (section 12) shows every attributed guest, the source, and any fee raised, so tenants can audit it.

## 9. Stage 6: Enters the store

Inside a store the guest sees only that tenant, rendered from the tenant's published configuration and filtered by what this guest is allowed to see.

### Rendering

- The store is rendered from the published storefront version (section 5.8): theme, sections, media, catalogue.
- Each item is filtered server-side by visibility against the guest's entitlements: admitted via which codes, active membership tiers, signed-in or not. Items a guest cannot see are never sent to the client.
- Prices shown in the market's currency with tax treatment from market config.
- Real-time availability hints ("next available: today 16:30") are cached for 60 seconds per offering.

### Isolation guarantees

- No other tenant's content, recommendations or ads appear inside a store. Navigating away is an explicit "Back to my places" action.
- API requests inside a store carry the tenant ID; every query is constrained by tenant (application layer plus database row-level security, section 18).
- The tenant sees only the store-scoped guest profile, never the guest's other stores.

### Store screens

| Screen          | Contents                                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Home            | Hero (cover image or video), tagline, featured offerings, sections as configured                                       |
| Menu            | Categories → offerings → variants and add-ons; filters (duration, price, staff)                                        |
| Offering detail | Media, description, variants, add-ons, policies summary, available dates/times, choose staff (if allowed), Book button |
| Team            | Staff profiles (if shown)                                                                                              |
| Memberships     | Tiers, benefits, join button                                                                                           |
| Content         | Free previews and paid collections; locked items show price or required tier                                           |
| Shop            | Products for pickup at visit                                                                                           |
| About           | Description, location (area or exact, per settings), hours, policies, reviews                                          |
| Chat            | In-app messages to the tenant; no phone numbers exchanged unless the tenant shows contacts                             |

### Live sessions

Houses and Ateliers can schedule live sessions (classes, demos, Q&As) for everyone admitted to the store, for selected membership tiers, or with a paid ticket (M-Pesa to the tenant's own account). Guests see "Live now" and "Upcoming", set neutral reminders, and join a viewer with live chat where they appear by alias. Hosts go live from a studio view (camera, microphone, viewer count, end). Optional replay. Guests can report a stream; platform staff can end it.

### Paid content gating

- Video is served by the streaming provider with **signed, short-lived URLs** issued only to entitled guests; links expire in minutes and are bound to the session, so sharing a link is useless.
- Purchases of digital content on iOS and Android follow app-store billing rules: by default, content purchase happens on the web store, and the app plays content the guest already owns. This is a per-platform switch in the console as store policies change.

## 10. Stage 7: Books and pays

The booking engine turns a guest's choice into a confirmed, paid reservation without ever double-booking a resource.

### 10.1 Booking flow (guest)

1. Choose offering and variant; optionally staff and add-ons; party size.
2. Choose date and time (slot mode) or check-in and check-out (night mode).
3. Review: itemised price, tax, deposit due now, balance due later, cancellation policy in plain words, arrival or check-in info release rule.
4. Guest details: confirm name or alias, notes, preferences; short-stay adds number of guests and guest registration (section 10.6).
5. Pay: choose provider (M-Pesa, card, wallet credit, package credit, membership credit, gift card); pay deposit or full amount.
6. Confirmation screen and notifications (section 16).

### 10.2 Holds and concurrency

- When the guest starts checkout, the engine places a **hold** on all required resources for the chosen slot or nights: default 10 minutes (configurable per market for slow M-Pesa flows).
- Holds are stored in the database with an expiry and protected by a uniqueness constraint per resource and time range (exclusion constraint on time ranges in PostgreSQL), plus a Redis lock during the hold transaction. Two guests can never hold the same resource-time.
- If payment succeeds before expiry → hold converts to a booking. If it expires → resources released, payment intent cancelled; a late successful payment follows the edge case in section 3.

### 10.3 Booking states

| State                                        | Meaning                                                                                              |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `held`                                       | Checkout in progress                                                                                 |
| `pending_payment`                            | Payment requested, awaiting confirmation                                                             |
| `requested`                                  | Request-to-book awaiting tenant approval (payment authorised or deposit taken, refunded if declined) |
| `confirmed`                                  | Paid as required; resources reserved                                                                 |
| `checked_in`                                 | Guest arrived (slot) or keys handed over (night)                                                     |
| `completed`                                  | Service done or guest checked out                                                                    |
| `cancelled_by_guest` / `cancelled_by_tenant` | With refund outcome recorded                                                                         |
| `no_show`                                    | Guest did not arrive; policy applied                                                                 |
| `disputed`                                   | Under review                                                                                         |

Every transition is an event (section 20) and is audit-logged.

### 10.4 Changes and cancellations

- **Reschedule:** guest MAY reschedule within policy; the engine re-checks availability and moves the deposit. Outside the free window, the tenant's policy decides (allowed with fee, or not allowed).
- **Guest cancellation:** engine computes the refund from the effective policy at the time of cancellation and shows it before the guest confirms.
- **Tenant cancellation:** always full refund; guest notified with a reason; repeated tenant cancellations are tracked as a quality signal.
- **No-show:** marked by staff after a grace period; deposit kept per policy.

### 10.5 Multi-service and group bookings (slot mode)

- One booking MAY contain several services in sequence (e.g. massage then facial) with different staff; the engine solves for a chain of available resources.
- Couples or group bookings reserve parallel resources (two therapists, one couples room).

### 10.6 Short-stay specifics (night mode)

- Availability considers iCal-imported blocks; on import conflict with an existing Stayvinci booking, the host is alerted immediately.
- Pricing: per-night rate from the rate plan, plus cleaning fee, extra-guest fee, taxes and tourism levy where configured; damage deposit collected as a separate payment and refunded after checkout unless the host files a claim within a set window.
- **Guest registration:** before check-in, the guest completes a digital form for each adult: full name, ID or passport number, nationality, phone; optional ID photo where the market requires it. Stored encrypted, visible only to the host and authorised roles, auto-deleted after the legal retention period.
- Check-in instructions (address, gate code, key box) are released only when the booking is fully paid and registration is complete.
- Levy: each completed stay's taxable amount is recorded for the host's monthly tourism levy report (section 21).

### 10.7 Credits and wallets

- Package and membership credits are consumed on confirmation and restored if the cancellation is within the free window.
- Gift card balances and refunds-as-credit are stored per guest per tenant; they are not transferable between tenants.

### 10.8 Staff-created bookings

Front desk can create bookings for walk-ins and phone calls from the business app, pick or create the guest profile, and take payment (send STK push to the guest's phone, card link, or record cash). These bookings are attributed `own_channel`.

## 11. Stage 8: Visits and returns

After confirmation, the system carries the guest through the visit and brings them back.

### Before the visit

- Reminders at tenant-configured times (default 24 hours and 2 hours before; 48 hours and morning-of for stays) over WhatsApp, SMS, push and email per guest preference.
- Reminder includes reschedule and cancel links; for stays, check-in instructions once released.
- Balance requests (if configured) sent ahead of the visit with a payment link.
- Practitioner sees the day's schedule with guest first name, service, notes and preferences.

### During the visit

- **Check-in:** front desk taps Check in, or guest scans the store's check-in QR; for Ateliers on home visits, the Atelier taps Arrived and Finished (safety log with timestamps; optional location share during the visit).
- **Service notes:** practitioner MAY add private notes (products used, pressure preference) to the guest's store profile; notes are never shown to the guest unless marked shareable.
- **Upsells at the counter:** add products or add-ons to the booking; pay the balance.

### After the visit

- Booking moves to `completed` (staff action or automatic at end time + grace).
- **Receipt** sent with itemised charges and payments.
- **Review request** after a configurable delay: 1–5 rating plus optional text, per booking. Reviews are tied to completed bookings only. Tenant can reply publicly once. Reviews pass moderation before showing on listed profiles.
- **Rebooking prompt:** "Book again" pre-fills the same service and staff.

### Retention tools

| Tool               | Behaviour                                                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Memberships        | Recurring billing on the membership's interval; credits issued each period; failed renewal → retries and notification, benefits paused after grace |
| Packages           | Credits tracked per guest; expiry reminders 14 and 3 days before                                                                                   |
| Loyalty (SHOULD)   | Points per spend or per visit, rewards defined by tenant                                                                                           |
| Referrals (SHOULD) | Guest shares a personal link; referred guest is still attributed `own_channel` for that tenant; reward to both on first completed booking          |
| Win-back (SHOULD)  | Tenant sends a message to guests who have not booked in N days, through the platform (guest contact details stay hidden)                           |

### Disputes

Guest MAY open a dispute on a booking within 14 days (e.g. charged after a free cancellation). Tenant responds in the business app; unresolved disputes escalate to platform Support, whose decision is recorded.

## 12. Stage 9: Stayvinci earns

The platform bills tenants for subscriptions, setup and marketplace fees through its own billing system, fully separate from guest payments.

### Revenue lines

| Line            | Trigger                                                     | Amount source                                                                                      |
| --------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Subscription    | Plan renewal date                                           | Plan catalogue (per market, per interval); amounts set later                                       |
| Setup fee       | Onboarding start, if the plan or deal includes it           | Plan catalogue or deal                                                                             |
| Marketplace fee | First completed booking of a `marketplace`-attributed guest | Market fee rule: percentage of the booking value with optional minimum and maximum; rate set later |
| Add-ons (later) | Activation                                                  | Plan catalogue                                                                                     |

No amounts are fixed in this spec; every price and rate is configuration in the platform console.

### Ledger

- Double-entry style ledger per tenant: subscription charges, fees raised, fee voids, credits, payments received, write-offs.
- Every marketplace fee entry references the booking, guest attribution record and rule version used, so any line can be explained.

### Billing cycle

1. Monthly invoice per tenant on its billing date: subscription (if monthly) plus all marketplace fees raised in the period, minus voids and credits.
2. Invoice delivered by email and in the business app; payable by M-Pesa STK push, card on file (auto-charge if enabled), or bank transfer with reference.
3. Tax on platform invoices per market rules (e.g. VAT once registered); invoice numbering sequential per market.

### Dunning

| Day after due | Action                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| 0             | Auto-charge attempt (if card or M-Pesa standing authority)                                              |
| 1, 3, 5       | Reminders: email, SMS, in-app banner                                                                    |
| 7             | Tenant `past_due`: owner banner, new marketplace listing paused                                         |
| 14            | Tenant `suspended`: store shows unavailable, existing confirmed bookings honoured, new bookings blocked |
| 60            | Account flagged for closure review by Finance                                                           |

### Fee dashboard (tenant view)

List of marketplace-attributed guests, their first booking, fee raised or pending, voids, and a plain-language explanation of each line. Tenants MAY dispute a fee line; Finance resolves it in the console.

## 13. Platform admin console

The internal web console where Stayvinci staff run the business; every module respects the platform roles in section 1 and every write is audit-logged.

| Module                          | What it contains and does                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview                        | Live counts: tenants by state, bookings today, payment success rate, open verification cases, open reports, invoices overdue, system health                                                                                                                                                                                                                                                                                                     |
| Tenants                         | Search and filter all tenants; tenant detail with profile, plan, state history, owners and staff, payment providers (masked), verification case, storefront preview, bookings summary, invoices, audit log. Actions: change state (with reason), extend grace, apply coupon, assign onboarding manager, read-only impersonation with consent                                                                                                    |
| Onboarding pipeline             | Kanban of prospects and new tenants: invited → paid → setting up → verification → ready → live; checklist progress; notes; owner per deal                                                                                                                                                                                                                                                                                                       |
| Verification queue              | Cases sorted by SLA; side-by-side document viewer; selfie match score; per-requirement decisions; templates of rejection reasons; decision history                                                                                                                                                                                                                                                                                              |
| Moderation queue                | New media and text awaiting review, guest reports, automated flags; approve, reject with reason, remove, warn tenant, escalate; repeat-offence counters                                                                                                                                                                                                                                                                                         |
| Guests                          | Lookup by phone or email (Support role); account status, devices, stores entered (count only unless break-glass), disputes; actions: lock account, force sign-out, process deletion request                                                                                                                                                                                                                                                     |
| Bookings and disputes           | Search any booking by reference; timeline of state changes and payments; dispute cases with both parties' statements and decision recording                                                                                                                                                                                                                                                                                                     |
| Payments monitor (Transactions) | Every guest payment across tenants (status, method Paybill/Till/card, flow STK push / C2B / manual, purpose, failure reason, time to confirm, attribution, pseudonymous guest reference), filters and CSV export; provider health per tenant, failing connections, stuck intents, callback error rates, unmatched payment volume. Guest names and phone numbers never appear; repeat guests are counted through a stable pseudonymous reference |
| Growth insights                 | Per tenant: revenue, bookings, guests, returning-guest rate and marketplace guests by month; first full month vs latest full month; latest month vs the revenue the owner declared at sign-up (self-reported, labelled as such); platform-wide monthly revenue through Stayvinci; CSV export                                                                                                                                                    |
| Billing and finance             | Plan catalogue (prices per market and interval), coupons, invoices, ledger per tenant, marketplace fee rules (versioned), fee disputes, dunning status, revenue reports, exports for accounting                                                                                                                                                                                                                                                 |
| Markets                         | Per country: currency, languages, tax rules, payment providers enabled, verification templates, compliance rules (e.g. guest registration fields, levy rate), legal documents and their versions                                                                                                                                                                                                                                                |
| Legal documents                 | Publish new versions of Terms, DPA, policies; force re-acceptance; see acceptance coverage                                                                                                                                                                                                                                                                                                                                                      |
| Content and marketplace         | Category taxonomy, featured collections, search synonyms, marketing banners, blocked words list                                                                                                                                                                                                                                                                                                                                                 |
| Notifications                   | Template manager for every message per channel and language, with preview and test send; provider settings (SMS, WhatsApp, email, push)                                                                                                                                                                                                                                                                                                         |
| Staff and access                | Platform user accounts, roles, 2FA enforcement, break-glass requests and approvals                                                                                                                                                                                                                                                                                                                                                              |
| Audit log                       | Global, filterable by actor, tenant, action, date; export                                                                                                                                                                                                                                                                                                                                                                                       |
| Ads                             | Stayvinci's own marketing: connect ad accounts (Meta for Instagram and Facebook, Google, TikTok, X, LinkedIn), create campaigns by goal (Houses sign up, guests install, awareness), market, audience, daily budget and creative with a feed preview; results per campaign (spend, clicks, results, cost per result) synced from each network. Paid from Stayvinci's marketing budget, never guest money                                        |
| Plans and entitlements          | Which features each plan includes; per-tenant overrides with reason and optional end date (see 13.1)                                                                                                                                                                                                                                                                                                                                            |
| Feature releases                | Release stage of each feature (internal → beta → released) and its test or pilot tenants (see 13.1)                                                                                                                                                                                                                                                                                                                                             |
| System                          | Background job dashboard, incident banner, maintenance mode, market-level kill switches                                                                                                                                                                                                                                                                                                                                                         |

### 13.1 Entitlements and feature release

Decided 2026-11-10 (ADR 0004). Two separate controls decide whether a tenant can use a feature:

1. **Release stage** (is the feature out?): `internal` (only test tenants picked by staff) → `beta` (named pilot tenants) → `released` (follows the plans). Only features that are built and deployed appear; the console cannot create features.
2. **Entitlement** (does this tenant's plan include it?): each plan lists its features. **Core** features (bookings and calendar, M-Pesa payments, private store and codes) are on for every plan.

Effective access, in order: a per-tenant override wins (on or off, with reason, optional end date, author) → core features are on → internal/beta features are on only for their testers → released features follow the plan.

- The API enforces entitlements on every request; the business app reads the tenant's effective features and shows locked features as a calm "Available on <plan>" card, never as an error.
- Plan changes apply immediately. Every change to a plan, stage, tester list or override is audit-logged.
- **Limits** (staff seats, locations, uploads, storage, SMS) are part of the same model but are **not enforced yet**: no upload or content limits during the pilot. Downgrade checks against limits (section 2) start when limits are switched on.

### 13.2 Appearance and help (all apps)

- Theme: System (follows the device), Light or Dark, saved per device; applied before first paint.
- Every page in the business app and console shows one short setup tip until closed; "Show tips again" restores them.
- The business app's top search finds guests, bookings, services, team, codes and memberships, offers quick actions, and answers common "how do I…" questions.

## 14. House admin (business app)

The tenant's workspace on web, Windows and Android; modules appear according to vertical (spa or short-stay) and the user's permissions.

| Module                  | What it contains and does                                                                                                                                                                                                             | Key permissions                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Today                   | Day timeline across staff, rooms or units; arrivals and departures; unpaid balances; alerts (failing provider, expiring documents, pending requests)                                                                                  | `booking.view`                                     |
| Calendar                | Day, week and resource views; drag to move bookings (with availability check); block time; colour by status; short-stay grid by unit and night with iCal-imported blocks shown                                                        | `booking.view`, `booking.edit`                     |
| Bookings                | List and search; booking detail with timeline, payments, notes; create, reschedule, cancel, mark no-show, check in, complete, refund                                                                                                  | `booking.*`, `payment.refund`                      |
| Requests                | Request-to-book queue with approve or decline and a countdown                                                                                                                                                                         | `booking.approve`                                  |
| Guests (CRM)            | Store-scoped guest profiles: visits, spend, preferences, notes, memberships, packages, attribution source. Contact fields shown only with `guest.contact.view`. Import existing guests. Remove a guest                                | `guest.view`, `guest.contact.view`, `guest.import` |
| Messages                | In-app chat inbox with guests; quick replies; attachments; assignment to staff                                                                                                                                                        | `message.reply`                                    |
| Catalogue               | Categories, services, variants, add-ons, units and rate plans, packages, memberships, products, gift cards; bulk edit prices; visibility per item                                                                                     | `catalogue.edit`                                   |
| Team and resources      | Staff profiles, schedules, leave; rooms, equipment, units; skills mapping (who can do which service); staff invitations and roles                                                                                                     | `staff.manage`                                     |
| Storefront              | Theme, sections, media library, preview, publish, version history and rollback, custom domain                                                                                                                                         | `storefront.edit`                                  |
| Content                 | Paid and free content collections, uploads, preview clips, pricing or tier mapping, view counts                                                                                                                                       | `content.edit`                                     |
| Access and visibility   | Visibility mode; access codes, invite links, QR downloads; usage stats per code                                                                                                                                                       | `access.manage`                                    |
| Policies and rules      | Deposits, cancellation, lead time, who can book, approval, short-stay rules; tenant-level and overrides                                                                                                                               | `policy.edit`                                      |
| Payments                | Connected providers (masked), test transaction, provider order; transactions list; unmatched payments queue; refunds; reconciliation status                                                                                           | `payment_account.manage` (Owner), `payment.view`   |
| Reports                 | Revenue by day, service, staff; occupancy (stays); utilisation (slot); no-shows and cancellations; memberships and packages liability; top guests (anonymised unless permitted); tourism levy and tax reports; exports to CSV and PDF | `report.*`                                         |
| Marketing               | Guest campaigns sent through the platform (no contact export), referral and loyalty settings, reviews and replies                                                                                                                     | `marketing.manage`, `review.reply`                 |
| Compliance (short-stay) | TRA licence details and expiry, unit documents, guest registration records (restricted), levy report history                                                                                                                          | `compliance.view`                                  |
| Billing                 | Plan, invoices from Stayvinci, payment method, marketplace fee dashboard, fee disputes, upgrade or downgrade                                                                                                                          | Owner only                                         |
| Settings                | Business profile, locations and hours, notification preferences, roles and per-person permissions, audit log, data export, close account                                                                                              | Owner or Manager per item                          |

### Business app behaviour

- Works offline for viewing today's schedule; changes made offline queue and sync with conflict checks.
- Windows build is the same web app in a Tauri shell with desktop notifications and a kiosk mode for reception.
- Every list supports search, filters, and export where permitted.

## 15. Atelier dashboard and guest app screens

Ateliers get a simplified business app; guests get a focused app built around their places, bookings and wallet.

### Atelier dashboard

Same engine as the House admin with a reduced, mobile-first layout:

| Area                  | Contents                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| Today                 | Upcoming appointments, travel time hints between home visits, Arrived and Finished buttons              |
| Calendar              | Own availability, blocks, travel zones                                                                  |
| Bookings and requests | Accept or decline requests, reschedule, cancel, no-show                                                 |
| Clients               | Store-scoped profiles, notes, packages                                                                  |
| My profile            | Photo, bio, portfolio, certificates and verification badge, categories                                  |
| Services              | Services, variants, travel fees, packages                                                               |
| Payments and reports  | Provider connection, transactions, earnings summary                                                     |
| Safety                | Emergency contact, visit check-in and check-out log, share live location during a visit, report a guest |
| Billing and settings  | Plan, invoices, notifications, privacy                                                                  |

### Guest app screen map

| Screen                 | Purpose                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| Welcome                | Sign in or continue as visitor; enter a code                                                        |
| My places              | Stores entered; search within them; hide a place                                                    |
| Discover               | Marketplace categories, search, map, filters                                                        |
| Store (sections 9)     | Home, menu, offering detail, team, memberships, content, shop, about, chat                          |
| Checkout               | Review, details, payment, confirmation                                                              |
| Bookings               | Upcoming and past; reschedule, cancel, receipt, review, dispute                                     |
| Stay pass (short-stay) | Guest registration, check-in instructions, house rules, checkout steps, damage deposit status       |
| Wallet                 | Packages, memberships, gift cards, credits, saved payment methods                                   |
| Content library        | Purchased and membership content, playback                                                          |
| Messages               | Chats with stores                                                                                   |
| Profile and privacy    | Name and alias, preferences, notifications detail level, app lock, devices, download or delete data |
| Help                   | FAQs, contact Support, safety reporting                                                             |

## 16. Notifications system

One notification service sends every message, driven by domain events and templates, with discretion as the default.

### Channels

Push (FCM, APNs), WhatsApp Business API, SMS (Africa's Talking or similar per market), email (Resend or similar), in-app inbox. Each channel has a provider adapter so providers can be swapped per market.

### How it works

1. A domain event (e.g. `booking.confirmed`) is published.
2. The notification service looks up subscribed templates for that event and audience (guest, tenant staff, platform).
3. It resolves channel order from recipient preferences and template defaults, renders the template in the recipient's language, and applies the discretion level.
4. It sends through the provider, records delivery status, and falls back to the next channel on failure (e.g. WhatsApp → SMS).
5. Quiet hours per recipient (default 21:00–07:00) delay non-urgent messages.

### Discretion levels for guest messages

| Level             | Example                                                              |
| ----------------- | -------------------------------------------------------------------- |
| Neutral (default) | "Your appointment on Fri 14 Nov at 16:00 is confirmed. Ref SV-7F3K2" |
| Named             | Adds the store name                                                  |
| Detailed          | Adds service and staff                                               |

### Core message catalogue (v1)

| Audience     | Messages                                                                                                                                                                                                                                                        |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guest        | OTP; booking confirmed; payment received; request approved or declined; reminder; reschedule or cancellation confirmation; check-in instructions released; balance due; receipt; review request; membership renewal or failure; package expiring; refund issued |
| Tenant staff | New booking; request needs approval; cancellation; payment failed; unmatched payment; provider failing; document expiring; review received; dispute opened; daily summary                                                                                       |
| Owner        | Verification outcome; invoice issued; payment overdue; plan changes; security alerts (new login, permission changes)                                                                                                                                            |
| Platform     | Verification case SLA breach; spike in payment failures; moderation backlog; dunning milestones                                                                                                                                                                 |

Templates are edited in the platform console; tenants MAY customise wording of guest messages within limits (no links to external payment, no contact details if hidden).

## 17. Trust, safety and moderation

The platform keeps every store premium and lawful; one misused profile can cost payment rails for everyone, so moderation is a core system, not an add-on.

### Content policy (enforced)

No sexual or sexually suggestive content or services, no nudity, no content that implies services outside the approved category, no contact details or off-platform payment instructions in public content, no misleading claims, nothing involving minors.

### Moderation pipeline

1. **Pre-publication review** for all new tenant media and public text until the tenant has a clean record (configurable threshold); afterwards, risk-based sampling.
2. **Automated checks:** image and video safety classification, text checks for blocked terms, phone numbers and external payment links. High-confidence violations are auto-held; others go to the queue.
3. **Human review** in the moderation queue with decision, reason code and notes.
4. **Enforcement ladder:** remove item → written warning → feature restriction (e.g. no listing) → suspension → closure. Severe violations go straight to suspension.
5. **Appeals:** one appeal per decision, reviewed by a different moderator.

### Reports

- Guests MAY report a store, a staff member, content or a message; tenants MAY report a guest.
- Reports have categories (safety, inappropriate content, fraud, harassment, other) and priority; safety reports for home visits are top priority with a target first response within 1 hour.

### Guest-side trust

- Ratings in both directions for home-visit Ateliers: Ateliers MAY rate guests; low-rated or reported guests can be blocked by an Atelier and flagged platform-wide.
- Guests booking home visits MUST have a verified phone and MAY be required (per category) to verify identity.

### Fraud controls

Velocity limits on bookings and payment attempts per guest and device, duplicate-account detection, monitoring of tenants with unusual refund or cancellation patterns.

## 18. Security, privacy and data protection

Discretion is the product promise, so security requirements are launch requirements.

### Tenant isolation

- Every tenant-owned table carries `tenant_id`. PostgreSQL row-level security policies enforce `tenant_id = current_setting('app.tenant_id')` on every query; the application sets this per request from the authenticated context. Platform staff queries use a separate role with explicit, logged access.
- Automated tests MUST attempt cross-tenant reads and writes on every API endpoint.

### Data classification

| Class            | Examples                                            | Controls                                                                       |
| ---------------- | --------------------------------------------------- | ------------------------------------------------------------------------------ |
| Secret           | Payment credentials, API keys                       | Envelope encryption via KMS, payments service only, never logged               |
| Highly sensitive | ID documents, guest registration data, selfies      | Separate encryption key, restricted roles, every view logged, retention limits |
| Personal         | Guest names, phones, emails, notes, booking history | Encrypted at rest, field-level hiding by permission, export controls           |
| Business         | Catalogue, prices, schedules                        | Standard controls                                                              |
| Public           | Published storefront content                        | CDN-cached                                                                     |

### Identity and access

- Passwords hashed with Argon2id; passkeys supported; OTP rate-limited.
- 2FA mandatory for all platform staff and tenant Owners; optional for other roles.
- Session revocation on password change and role change.

### Data protection compliance (Kenya first)

- Stayvinci registers with the Office of the Data Protection Commissioner as a data processor (and controller for guest accounts).
- Data Processing Agreement with every tenant (section 2).
- Data subject rights: guest export and deletion in-app; tenant export of its own data; deletion workflows propagate to backups by expiry.
- Breach response plan: detection, containment, notification to the regulator and affected parties within legal timelines.
- Privacy notice states where data is hosted.

### Application security

- OWASP Top 10 controls; input validation; output encoding; CSRF protection on web; strict CORS.
- Rate limiting per IP, user and tenant on auth, booking and payment endpoints.
- Dependency scanning and secret scanning in CI; penetration test before public launch and annually.
- Backups: nightly full plus point-in-time recovery; restore drill every quarter.

## 19. Core data model

The main entities and their relationships; field lists are indicative and will be finalised in the schema design. All tenant-owned tables carry `tenant_id`, `created_at`, `updated_at`, and soft-delete where noted.

| Domain       | Entity                                                                                                                             | Key fields and relationships                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Platform     | `market`                                                                                                                           | code, currency, timezone default, tax rules (JSON), enabled providers, compliance config          |
| Platform     | `plan`, `plan_price`                                                                                                               | plan code, tenant types allowed, limits; price per market and interval                            |
| Platform     | `legal_document`, `legal_acceptance`                                                                                               | type, version, url; who accepted, when, IP                                                        |
| Identity     | `user`                                                                                                                             | phone, email, name, auth methods, 2FA; one per person (staff and guests share this table)         |
| Identity     | `membership` (user ↔ tenant)                                                                                                       | role, capability overrides, status                                                                |
| Tenant       | `tenant`                                                                                                                           | type (house, atelier), vertical, market, handle, state, plan subscription ref                     |
| Tenant       | `location`, `service_area`                                                                                                         | address, geo, hours; travel zones                                                                 |
| Tenant       | `resource`                                                                                                                         | type (staff, room, equipment, unit, self), location, capacity, schedule ref, visibility           |
| Tenant       | `schedule`, `schedule_exception`                                                                                                   | weekly rules; date overrides                                                                      |
| Verification | `verification_case`, `verification_document`                                                                                       | requirement, file ref (encrypted), decision, reviewer                                             |
| Storefront   | `storefront_version`                                                                                                               | theme, sections (JSON), status draft or published                                                 |
| Catalogue    | `category`, `offering`, `variant`, `addon`, `rate_plan`, `package`, `membership_tier`, `product`, `content_item`, `gift_card_type` | prices, durations, resource requirements, visibility, policy overrides                            |
| Access       | `access_code`, `store_admission`                                                                                                   | code, scope, limits; guest ↔ tenant admission with source                                         |
| Guests       | `guest_profile`                                                                                                                    | user ↔ tenant; alias, preferences, notes, tags                                                    |
| Attribution  | `attribution`                                                                                                                      | guest user, tenant, source (own\_channel, marketplace), first touch detail, fee status            |
| Booking      | `hold`, `booking`, `booking_item`, `booking_resource`                                                                              | state, times or nights, party, prices; resources reserved with time ranges (exclusion constraint) |
| Booking      | `stay_registration`                                                                                                                | per adult guest; encrypted fields                                                                 |
| Payments     | `payment_provider_connection`                                                                                                      | provider, encrypted credentials ref, state                                                        |
| Payments     | `payment_intent`, `payment`, `refund`, `provider_callback`                                                                         | amounts, purpose, provider refs, raw payload                                                      |
| Wallet       | `package_balance`, `membership_subscription`, `gift_card`, `guest_credit`                                                          | balances and validity                                                                             |
| Engagement   | `review`, `message_thread`, `message`, `notification`                                                                              | links to booking and tenant                                                                       |
| Trust        | `moderation_item`, `report`, `enforcement_action`                                                                                  | target, decision, reason                                                                          |
| Billing      | `subscription`, `invoice`, `invoice_line`, `ledger_entry`, `fee_rule`, `coupon`                                                    | platform money only                                                                               |
| Audit        | `audit_log`                                                                                                                        | actor, tenant, action, target, before/after, IP                                                   |

**Money:** stored as integer minor units with currency code; never floats. **Time:** stored in UTC with the location's IANA time zone for display; slot generation computed in local time to handle daylight-saving markets later.

## 20. Architecture, APIs, events and integrations

A modular monolith with clear module boundaries gives a small team speed now and a clean path to split services later.

```
 Guest app & web      Business app        Platform console    Payment providers
 (Android/iOS/web)    (web/Windows/And.)  (Stayvinci staff)   (callbacks)
        \                  |                   |                 /
         +------------------------- API gateway ------------------+
                      (auth, tenant context, rate limits)
                                    |
        +------------- Modular monolith (TypeScript) -------------+
        | Identity, Tenants, Verification, Storefront, Catalogue,  |
        | Access, Availability, Booking engine, Payments, Wallet,  |
        | Attribution, Notifications, Moderation, Billing,         |
        | Reporting, Audit  -- internal interfaces + domain events |
        +----------------------------------------------------------+
            |                    |                        |
   PostgreSQL + Redis    Media storage + streaming   Background workers
   (RLS, holds, queues)  (images, signed video)      (callbacks, reconciliation,
                                                      iCal, notifications, billing)
```

### Stack

| Layer            | Choice                                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| Guest apps       | React Native (Expo) for Android and iOS; React web (Next.js) for SEO-friendly store pages                             |
| Business app     | React web; Tauri shell for Windows; React Native for Android                                                          |
| Platform console | React web, internal only, behind SSO and 2FA                                                                          |
| Backend          | TypeScript (NestJS) modular monolith; REST with OpenAPI spec (GraphQL MAY be added for the apps)                      |
| Data             | PostgreSQL (row-level security, exclusion constraints for bookings); Redis (cache, locks, queues)                     |
| Jobs             | Queue-based workers (BullMQ or similar) for callbacks, reconciliation, iCal, notifications, billing, media processing |
| Media            | Object storage (Cloudflare R2) and a streaming provider (Bunny Stream or Cloudflare Stream) with signed URLs          |
| Search           | PostgreSQL full-text and geo for v1; dedicated search engine when volume demands                                      |
| Observability    | Structured logs, metrics, tracing, error tracking (Sentry), uptime checks                                             |
| Hosting          | Start on one VPS with Docker; move to managed database and multiple app instances as load requires                    |

### API conventions

- Versioned base path `/v1`; resources are tenant-scoped (`/v1/tenants/{tenantId}/bookings`) for business endpoints and guest-scoped (`/v1/me/...`) for guests.
- Idempotency keys required on all POSTs that create money movements or bookings.
- Cursor pagination; ISO 8601 times; money as `{amount_minor, currency}`.
- Errors in a consistent shape with machine-readable codes.

### Domain events (examples)

`tenant.state_changed`, `verification.decided`, `provider.verified`, `storefront.published`, `access_code.used`, `attribution.created`, `hold.created`, `hold.expired`, `booking.confirmed`, `booking.cancelled`, `booking.completed`, `payment.succeeded`, `payment.failed`, `refund.issued`, `review.submitted`, `membership.renewed`, `fee.raised`, `invoice.issued`, `report.created`. Events are written in the same transaction as the change (outbox pattern) and consumed by workers.

### External integrations

| Integration                             | Purpose                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------ |
| Safaricom Daraja                        | M-Pesa STK push, C2B confirmation, reversals and B2C where enabled, per tenant credentials |
| Card gateway (one for v1)               | Card payments, tokenisation, refunds, webhooks                                             |
| PayPal (SHOULD)                         | International guests                                                                       |
| Identity verification provider          | Liveness and ID-to-selfie matching for Ateliers                                            |
| WhatsApp Business API, SMS, email, push | Notifications                                                                              |
| iCal                                    | Short-stay calendar import and export                                                      |
| Maps and geocoding                      | Addresses, distance, map pins                                                              |
| KMS                                     | Encryption keys for secrets and sensitive data                                             |

### Public webhooks for tenants (later)

Tenants on higher plans MAY subscribe to booking and payment events for their own systems (accounting, door locks).

## 21. Reporting and analytics

Tenants get the numbers that run their business; the platform gets the numbers that run Stayvinci. Reports read from a reporting replica, never the primary database.

### Tenant reports

| Report                   | Measures                                                                                | Filters                               |
| ------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------- |
| Revenue                  | Gross sales, deposits, balances, refunds, net, by payment provider                      | Date range, location, category, staff |
| Bookings                 | Count, value, source (own vs marketplace), cancellations, no-shows, lead time           | Date, location, service               |
| Utilisation (slot)       | Booked hours ÷ available hours per staff and room                                       | Date, resource                        |
| Occupancy (night)        | Nights sold ÷ nights available, average nightly rate, revenue per available night       | Date, unit                            |
| Guests                   | New vs returning, retention by month, top services (no contact data without permission) | Date                                  |
| Memberships and packages | Active members, renewals, churn, outstanding credits (liability)                        | Tier                                  |
| Staff performance        | Bookings, revenue, ratings per practitioner                                             | Date, staff                           |
| Tax and levy             | Taxable sales by tax class; short-stay gross receipts for the tourism levy return       | Month                                 |
| Marketplace fees         | Fees raised, voided, invoiced                                                           | Month                                 |

All reports export to CSV and PDF; scheduled email delivery (weekly, monthly) SHOULD be supported.

### Platform analytics

Tenants by state and vertical, activation funnel (signed → paid → verified → live → first booking), bookings and gross booking value, payment success rate per provider, marketplace share of first bookings, fee revenue, subscription revenue and churn, verification and moderation SLA performance, guest growth and retention, app crash rates.

### Product analytics

Privacy-respecting event tracking in apps and web (screen views, funnel steps, errors); no guest personal data in analytics payloads; consent where required.

## 22. Non-functional requirements

Targets for v1; revisit after the pilot with real traffic.

| Area          | Requirement                                                                                                                                                                |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Availability  | 99.5% monthly for guest booking and payment APIs; planned maintenance outside 22:00–06:00 EAT only with notice                                                             |
| Performance   | Store page first meaningful paint under 2.5 s on a mid-range Android phone over 3G; API p95 under 300 ms for reads, 800 ms for booking writes (excluding provider latency) |
| Correctness   | Zero double bookings: enforced by database constraint, covered by concurrency tests                                                                                        |
| Payments      | No lost payments: every provider callback stored before processing; reconciliation closes any gap within 24 hours                                                          |
| Scalability   | Designed for 1,000 tenants and 100,000 guests without architectural change; stateless app servers scale horizontally                                                       |
| Recovery      | RPO 15 minutes (point-in-time recovery), RTO 4 hours                                                                                                                       |
| Accessibility | WCAG 2.1 AA for guest web and apps: contrast, screen-reader labels, focus order, touch targets ≥ 44 px                                                                     |
| Localisation  | All strings externalised; English at launch; Swahili SHOULD follow; currency and date formats per market                                                                   |
| Devices       | Android 9+, iOS 16+, last two versions of major browsers; business app usable at 1024 px and on phones                                                                     |
| Connectivity  | Graceful handling of slow or dropped connections; retries with idempotency; offline view of today's schedule in the business app                                           |
| Auditability  | Every privileged action and every money movement traceable to an actor and a time                                                                                          |
| Privacy       | No guest personal data in logs, analytics or error reports; masking enforced by a logging filter                                                                           |
| Testing       | Unit tests on domain logic, integration tests per provider (sandbox), end-to-end tests of the core workflow, cross-tenant security tests in CI                             |

## 23. Build phases and open questions

Build the spa path end to end first; every later phase reuses the same engine.

| Phase              | Scope                                                                                                                                                                                                                                                                                                                           | Exit criteria                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| P0 Foundations     | Monorepo, CI, environments, auth, tenants, roles, audit log, row-level security, design system                                                                                                                                                                                                                                  | Cross-tenant tests pass; staff and owner can sign in with 2FA        |
| P1 Spa MVP         | Joining, M-Pesa provider connection, House verification, storefront, catalogue (services, variants, add-ons), resources and availability, slot booking engine, deposits, private codes, guest web, business app (web), notifications (WhatsApp/SMS/email), platform console (tenants, verification, moderation, billing basics) | 3 design-partner spas take real paid bookings end to end             |
| P2 Pilot hardening | Card gateway, reconciliation, refunds, packages and memberships, reviews, reports, Android guest app, Windows business app, fee dashboard and invoicing                                                                                                                                                                         | Partners renew; payment success rate and support load within targets |
| P3 Marketplace     | Listed mode, search and browse, attribution and marketplace fees, iOS app, paid content                                                                                                                                                                                                                                         | First marketplace-attributed bookings invoiced correctly             |
| P4 Short-stay      | Night mode, units and rate plans, iCal sync, guest registration, damage deposits, TRA and levy reports                                                                                                                                                                                                                          | First hosts live with synced calendars                               |
| P5 Ateliers        | Atelier verification with liveness, service areas and travel fees, home-visit safety, two-way ratings                                                                                                                                                                                                                           | First verified Ateliers live                                         |
| P6 Expansion       | Second market configuration, Swahili, loyalty and referrals, tenant webhooks, Signature white-label                                                                                                                                                                                                                             | Second market launched                                               |

### Open questions

- [ ] Plan prices, setup fees and marketplace fee rate (to be set after interviews)
- [ ] Card gateway for v1
- [ ] Identity verification provider for Ateliers
- [ ] Whether marketplace fees are invoiced monthly only, or also collected at source where split payments exist
- [ ] Exact retention periods for ID documents and guest registration data (legal advice)
- [ ] iOS at P1 or P3, given the premium segment
- [ ] Short-stay: which TRA and levy details can be verified automatically versus manually
