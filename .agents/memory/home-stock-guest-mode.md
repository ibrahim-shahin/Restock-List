---
name: Home Stock guest mode
description: Account boundary for Home Stock guest inventory and optional cloud sync.
---

Guest mode is a separate, device-local inventory. On iOS and Android, local state is stored in SQLite; the web preview continues to use AsyncStorage. Signing in is optional and is the explicit action that links the guest inventory to one account for PostgreSQL cloud sync. After that account has saved it, the guest copy is removed; account-only changes never flow back to guest mode or another account.

**Why:** The user chose local SQLite with optional cloud sync, while keeping sign-in optional and each account’s stock private from other accounts on the same device. Removing the migrated guest snapshot also prevents stale guest items from being re-added after account-side edits.

**How to apply:** Preserve separate guest and account storage, plus a single-account migration marker, when changing authentication, sign-out, or cloud reconciliation. Migrate existing AsyncStorage keys into native SQLite before removing their old copies. If sync fails, retain the guest snapshot until the account copy has synced successfully.
