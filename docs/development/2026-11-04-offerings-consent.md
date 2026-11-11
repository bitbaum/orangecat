# Economic offerings sharing consent — 2026-11-04

The public offerings view exposed passively learned skills, assets, asked-for
and not-available-for fields without a separate owner sharing decision. The
base table's owner-only RLS protected other economic fields but the public view
intentionally ran with the view owner's access. A memory preference therefore
was not a public sharing control.

The additive migration adds `public_offerings_enabled`, false for existing and
new rows, and filters the existing narrow view by that decision. Learned data
stays in the private base table. The owner sees the exact offer-facing preview
on their own profile and deliberately chooses Make offerings public or Hide
offerings. The copy explains that future changes to these fields are public
while sharing is enabled. Goals, constraints, motivation and stage never enter
the public projection. Cat's save action cannot change the sharing flag.

The authenticated route takes ownership exclusively from the session. It
rejects extra fields and non-boolean decisions, rate-limits writes, and upserts
only the sharing flag without replacing the learned profile. Read/write errors
remain visible; the UI changes state only from a successful canonical response.
Visitors still use only the public view; the private preview route is mounted
only for the owner.

## Evidence and remaining gates

- 22 focused domain, route, UI and no-background-AI tests passed. Includes
  forged-owner input, private field omission, failed writes, and sharing only
  after an explicit click.
- The real additive SQL was applied in a minimal PostgreSQL-compatible PGlite
  fixture with authenticated/anonymous roles and equivalent owner policies:
  anonymous rows absent by default, cross-owner update denied, one public row
  after opt-in, none after revocation. This is local policy evidence, not a
  production two-account isolation test or complete migration replay.
- Actual owner component and app CSS were built into a temporary browser
  harness. Mocked API responses exercised share/hide at 320/390/1440 widths;
  all had zero overflow and 44-pixel sharing targets. This is component evidence,
  not live application verification. Screenshots remain outside the repository.
- Required normal hooks, full CI, Migration Replay, deployed receipt, and an
  isolated two-account live privacy journey remain required. Hold this migration
  PR until replay and application gates pass. Never apply it by hand.
- Generated live database types were not edited manually; regenerate through
  the documented workflow after the migration lands.
