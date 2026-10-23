# Cat platform-navigation grounding review

The deployed #1401 browser check, on a fresh anonymous test account, returned HTTP 200 and no new passive memory for “I want to write an article. Where is the article editor?” But its answer was exactly “Not in your data.” No article link or navigation chip appeared. This is a failed writing-help journey, despite successful prompt-presence tests. Evidence: `/workspace/orangecat-review-evidence/cat-writing-deployed.png` and the sanitized browser-check log.

The prompt assembly appends ai-kit's grounding rules after the base application brief. Their refusal wording can be read as covering every request, even known application navigation. The current user-record context and grounding-repair evidence also omit the application's verified writing capabilities.

A focused adapter now derives writing names, descriptions and destinations from CREATE_OPTIONS, appends their explicit application scope after the shared grounding rules and includes them in repair evidence. It keeps ai-kit's user-record checks; it does not license invented roles, employers or relationships. Supported Create links also join action blocks as content a repair may not silently drop.

The regression cases exercise actual prompt assembly under the free-model budget, catalog parity, rejection of invented destinations and repair preservation of valid links. Existing contact-fabrication and production prompt-budget cases remain in the run. Full `pnpm run verify` passed on 2026-10-23 (552.8 seconds), including unit tests, lint, types and repository guards. Another deployed-model browser check remains required; this note does not certify the failed journey as fixed.

The separate disposable test session used during the initial check was revoked after a harness error included its cookie in diagnostics. A fresh guest was created through ordinary onboarding. Reads now run inside the browser and error logging retains only the first line. This was not the owner's account.
