# Setup task review

A fresh guest's live dashboard at 390px put an Add Bitcoin Wallet task with a red Critical label ahead of profile details. The card's narrow heading and progress block wrapped into several lines. Source review also found Show more only set the already-expanded state without increasing the visible task count.

Wallet connection is now a medium-priority suggestion with conditional payment wording, excluded from the critical/high setup-completion denominator. Profile suggestions retain their internal ordering but no longer display urgency badges. The heading makes clear that setup choices do not block using OrangeCat. Its layout wraps the progress controls as a group rather than squeezing the title. Collapse and completion controls have 44px targets; completion names identify their task.

Show more now reveals the remaining returned tasks, preserving that choice across collapse/expand. It does not claim to paginate beyond the recommendations endpoint's returned limit. Two UI regression tests cover disclosure and the wallet priority/neutral presentation. Existing account data is not changed.

The same guest flow exposed a generated identifier in the greeting. The header now uses the existing shared minted-handle detector, including longer generated suffixes, and preserves a chosen display name.

Closed mobile sidebar links were only translated off-screen, leaving them in the accessibility tree and keyboard tab order. The drawer is now inert and hidden to assistive technology while closed; its existing focus-lock package returns focus, and Escape dismisses an open drawer. Two regression cases cover closed/open visibility and dismissal.

The mobile Create sheet now uses the shared Radix dialog instead of a bespoke overlay. It has a dialog title, focus management, close/Escape/outside dismissal and return focus to Create. Its regression exercises Article/Post destinations, Escape, reopening and Close. No parallel dialog implementation or new dependency was added. Phone Chromium verified the dialog bounds, editor destination, Escape and focus return without overflow before release.
