---
name: Expo Go preview storage
description: Replit mobile-preview persistence limits and how to protect Home Stock data.
---

Replit's Expo Go preview is temporary: AsyncStorage data is not guaranteed to survive when a preview session ends, and it does not migrate to a published app.

**Why:** The user reported losing inventory after republishing. Replit's official mobile-app documentation says preview storage is temporary and separate from the published build.

**How to apply:** Never promise that Expo Go preview data will survive a reload, session end, or publication. Offer manual JSON export before changes and propose production persistence if the user wants reliable retention.