# ADR 0004: Platform console, pilot control and entitlements

- Status: accepted
- Date: 2026-11-10
- Spec: sections 1 (platform roles), 2 (sign-up), 3 (M-Pesa modes), 13 and 13.1

## Context

Most early clients won't know how to set up a store on their own. Felix wants to onboard and help them remotely from his side, watch clean transaction data to prove that Stayvinci grows revenue for businesses, and switch features on per plan or per business as the product grows. Businesses must also be able to sign up and run without Stayvinci staff.

## Decision

1. **Console roles:** Super admin, Admin, Finance, Marketing (mirroring the business side). Trust & safety and Support can be split out later.
2. **Pilot control (assist mode):** Super admins and Admins can open any House's business app with full owner capabilities and no per-session consent step. Safeguards: a visible "Stayvinci support (name)" banner; every change goes into the House's own audit log under that name; no access to decrypted payment credentials; the owner alone accepts agreements and enters M-Pesa credentials.
3. **Entitlements and releases are separate:** release stage (internal → beta → released, with tester lists) decides whether a feature is out at all. Plans decide who gets released features. Per-House overrides (with reason, optional end date and author) win over both. Core features (bookings, M-Pesa, private store) are on for everyone.
4. **No limits yet:** the model has room for limits (seats, uploads, storage, SMS), but none are enforced during the pilot.
5. **M-Pesa for every House:** Paybill or Till, either automatic (Daraja STK push and C2B) or manual (the guest pays the shortcode and staff confirm with the transaction code).
6. **Transaction data, not money:** the console sees every payment record across Houses, with guests only as pseudonymous references. Stayvinci never holds guest funds.
7. **Growth insights** compare each House's first full month on Stayvinci with its latest month (measured), and the latest month with the revenue the owner declared at sign-up (self-reported and labelled as such).

## Consequences

- The API needs a platform-scoped auth context alongside the tenant context. Assist sessions are short-lived platform tokens bound to one tenant, carrying the actor's name for audit.
- Entitlement checks become a guard next to `@RequireCapability()` (e.g. `@RequireFeature('memberships')`).
- The business app must read effective features and show locked states; it doesn't do this yet.
- In the prototype, console and business app data are separate in-browser mocks. "Manage store" works for the two demo Houses with full store data (Serenity, Karibu), and changes made in the console (plans, overrides) don't reach the business app until the API exists.
