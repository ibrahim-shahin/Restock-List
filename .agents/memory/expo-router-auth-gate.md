---
name: Expo Router auth gate
description: Avoid a blank Expo preview when applying authentication guards to the root route.
---

When protecting Expo Router screens, keep the root navigator mounted and guard auth and app route groups inside the navigator or their layouts. Returning a root-level redirect before the navigator mounts can leave the initial route blank even when the sign-in route works directly.

**Why:** The Home Stock root path stayed blank while the direct sign-in path rendered; moving the redirect into the auth/tab layouts fixed the initial route.

**How to apply:** For future Expo auth changes, verify both the signed-out root path and direct auth routes after adding group guards.
