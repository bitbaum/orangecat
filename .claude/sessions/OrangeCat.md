status: idle
done:

- fleetwave→loki rename pass shipped (commit 6d22f001).
- Live UI tour at orangecat.ch found two bugs on the logged-in dashboard:
  1. "Recommended Next Steps" card showed "100% Setup" next to "3 tasks remaining" — the % filtered to critical+high tasks while the count included Suggested/Optional. Fixed in TasksSection.tsx so both metrics scope to the same priority set; reads "Setup complete" when zero critical+high remain.
  2. ProfileProjectsTab.tsx referenced an undefined `IntegrationNote` ("defined above" — but it wasn't), leftover from the fleetwave rename. Dead assignment, never read. Deleted; `npx tsc --noEmit` is now clean.
- Both fixes shipped to main and pushed; live deploy to the Hetzner box.

next: open items observed but not yet addressed —

- Loki project profile has duplicate tags "Open Source" + "open-source" (data-level dedupe needed on the project row).
- Onboarding step 1 has "Prefer manual setup? Continue to choose…" as flat text — should be a button/link to the manual setup path.
- Dashboard banner "Welcome back mao" — username lowercased, no comma; improve to "Welcome back, mao" or proper-cased display name.
