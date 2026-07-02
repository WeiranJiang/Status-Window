# Chrome Web Store Reviewer Notes

Paste a version of this into the Chrome Web Store "Reviewer notes" field before submission.

## Single purpose

Status Window is a study timer and session tracker. Users can:

- sign in,
- create subjects,
- run a timer or stopwatch,
- save study sessions,
- review stats and challenge progress,
- optionally use the friends view for shared progress summaries.

The side panel is not a separate product feature. It is just an alternate always-visible timer surface for the same study-tracking purpose.

## Test account

If reviewer login is required, provide working credentials here:

- Email: `REPLACE_ME`
- Password: `REPLACE_ME`

If Google OAuth is the preferred path, still provide an email/password test account so review is not blocked by consent-screen issues.

## How to test

1. Open the extension popup.
2. Sign in with the reviewer test account.
3. In `Settings`, create or rename a subject.
4. In `Log`, start a timer or stopwatch and then stop it to create a session.
5. Open `Stats` to confirm the session appears in history and updates the charts/progress.
6. In `Stats`, create or edit a challenge to confirm backend sync for challenges.
7. In `Settings`, archive a subject, restore it, and delete one if needed.
8. Optional: open the side panel timer from `Settings` to test the always-visible timer mode.

## Permissions explanation

- `storage`: saves extension state and user settings.
- `identity`: used only for extension OAuth login flow.
- `alarms`: keeps timers running accurately in the background.
- `sidePanel`: supports the optional always-visible timer panel.
- `offscreen`: supports timer completion audio when popup UI is closed.
- Host access is limited to the configured Supabase project domain for auth and data sync only.

## Important notes for review

- There is no remote executable code. Scripts are bundled locally.
- This is Manifest V3 with a service worker background.
- If email/password login is enabled in production, the reviewer test account should already be activated and ready to use.
