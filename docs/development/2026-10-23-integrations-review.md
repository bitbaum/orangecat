# Integrations identity and phone review

A production browser check found one identity in the API response but zero options in both Acts as selectors. The API returns its shared success envelope, `data.actors`; useMessagingActors read a top-level actors field. This shared hook also feeds messaging and creation controls.

The hook now reads the actual envelope, rejects incomplete responses, exposes Retry and cancels stale account requests. Integrations shows identity loading and recovery controls. Key and webhook creation validate that the chosen identity remains in the current options; a stale selection cannot be submitted. An explicit placeholder avoids showing an apparent selection while no valid identity is selected.

Connected apps now offers Retry after a failed load. Pending saves and revocations are tracked per app so one completion cannot unlock another pending request. A permission update also disables that app's disconnect action; failed updates still restore the prior choice.

Phone review measured 16px checkbox rows and a broken scope grid falling into one column. Permissions now use named resource groups and separate Read/Write choices with 44px touch rows. Webhook events have the same touch clearance. Sandbox explanatory text wraps as one text block. Both creation forms share a native disclosure and disable their fields during submission; existing lists remain easy to reach. Text fields already met 16px/44px phone sizing before this batch.

Nine focused checks passed, covering the envelope, malformed responses, retry, stale account responses, connected-app recovery, overlapping pending saves, stale identity submission and read-only scope payloads. Real Chromium previews at 390px phone, 820px tablet and 1440px desktop passed both retries, keyboard expansion, actual identity selection, independent permissions, minimum 44px rows and no horizontal overflow. All read APIs were served by the actual production backend; credential writes were blocked and remained zero. Full `pnpm run verify` passed in 1,117.3 seconds: 639 test files and 5,376 tests, with all repository guards. Removing an arbitrary font size also lowered the type-scale ratchet from 9 to 8.

No credentials or endpoints were minted, no external apps connected or disconnected, and no actual app claims were changed. Unit tests use fabricated apps and intercepted requests. This does not certify credential issuance, webhook delivery or a real group-owned integration.

The final gate uses the patched runtime dependencies. The fast-uri override is
raised to 3.1.9 to close the newly reported URI-parsing advisories; the final
production dependency audit reports zero known vulnerabilities.
