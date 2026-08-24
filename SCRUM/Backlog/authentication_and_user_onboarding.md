---
status: backlog
priority: P2
agent_claimed: null
claimed_at: null
updated: 2026-08-20
---

# Authentication and User Onboarding

> **Repo:** ECHO
> **Description:** Sign-up/login flow with social auth and onboarding screens

---

## Context

Every app needs auth. Build sign-up, login, and guided onboarding for first-time users.

---

## Acceptance Criteria

- [ ] Email/password signup with email verification
- [ ] Social auth (Apple, Google) via Expo Auth Session
- [ ] Onboarding carousel explaining core features
- [ ] Profile setup screen with preferences and notification opt-in

---

## Technical Notes

- Supabase Auth or custom JWT; Expo AuthSession for social; AsyncStorage for onboarding completion flag
