# PWA install metadata review

The production browser fetched every declared manifest icon successfully. It also reproduced three 404 screenshot resources and two protocol targets at the missing `/payment` page. The repository has no file-launch receiver for the advertised image/video file handlers. These declarations made the install metadata promise unavailable resources or flows.

The manifest now advertises the existing icons and working shortcuts, without the dead screenshot gallery, protocol targets or unimplemented file handler. The Create shortcut uses a general description that includes the writing entry. The unused `src/app/metadata.ts` copy was removed; the actual layout reads versioned icon URLs from the generated brand-assets producer. Repository references to the removed module were checked before deletion.

The existing brand generator ran successfully and reproduced every icon byte-for-byte; only manifest metadata changed. Public browser evidence is `/workspace/orangecat-review-evidence/install-manifest-evidence.json`. This does not certify an Android installed launcher or splash refresh: an actual device check is still needed. The 24 existing brand-mark tests passed after regeneration. Full `pnpm run verify` passed (749.4 seconds), including tests, types, lint and repository guards. Deployment verification remains pending.
