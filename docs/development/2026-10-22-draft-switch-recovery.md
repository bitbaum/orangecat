# Draft switching and cleared content

Source review found that `loadDraft` flushed current writing but replaced the fields even when local storage rejected the write. The pending snapshot was then overwritten by the selected draft. Switching now stops on failure and retains the current fields, draft identity and visible save error for retry.

The snapshot also treated empty fields as an untouched composer. After clearing a previously saved draft, leaving the page restored the older text. The hook now tracks whether this draft has started: it saves cleared fields for that draft without creating empty records merely by opening a fresh composer.

Eight hook regression cases pass, including failed-save switching and retry, clearing saved text, untouched composers, immediate navigation, pagehide and discard. These changes do not claim account-scoped storage or edit-draft recovery; those remain separate work.
