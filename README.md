# Status Window

Status Window is a Chrome extension for tracking study or work sessions with a cozy popup UI, Supabase authentication, subject management, stats, and a background-persistent timer.

## Stack

- Chrome Extension Manifest V3
- React + TypeScript + Vite
- Tailwind CSS
- Recharts
- Supabase Auth + Postgres
- Background service worker with `chrome.storage.local`
- Side Panel API for always-visible mode
- Offscreen document for timer completion audio

## Install dependencies

```bash
npm install
```

## Environment variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

You can copy from `.env.example`.

## Supabase project setup

1. Create a new Supabase project.
2. In `Authentication > Providers`, enable Email and Google.
3. In `Authentication > URL Configuration`, add your Chrome extension redirect URL after you first load the unpacked extension:
   `https://<your-extension-id>.chromiumapp.org/supabase-auth`
4. Copy the project URL and anon key into `.env`.

## SQL: schema

Run this in the Supabase SQL editor:

```sql
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id),
  mode text not null check (mode in ('stopwatch', 'timer')),
  start_time timestamptz not null,
  end_time timestamptz not null,
  duration_seconds integer not null check (duration_seconds >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  theme text not null default 'light',
  color_scheme text,
  button_sounds_enabled boolean not null default true,
  tab_sounds_enabled boolean not null default true,
  timer_sound_enabled boolean not null default true,
  volume numeric not null default 0.5,
  floating_mode_enabled boolean not null default false,
  created_at timestamptz not null default now()
);
```

## SQL: Row Level Security

```sql
alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.study_sessions enable row level security;
alter table public.user_settings enable row level security;
```

## SQL: policies

```sql
create policy "profiles own rows"
on public.profiles
for all
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "subjects own rows"
on public.subjects
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "study_sessions own rows"
on public.study_sessions
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "user_settings own rows"
on public.user_settings
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
```

If you rerun policies in an existing project, add `drop policy if exists ...` first.

## Email/password auth

1. In Supabase, enable Email provider.
2. For the smoothest extension flow, disable email confirmation while testing, or expect signup to show a success message without logging in immediately.

## Google OAuth setup

1. In Google Cloud Console, create OAuth credentials for a Web application.
2. Add this Authorized redirect URI:
   `[https://your-project-ref.supabase.co/auth/v1/callback](https://your-project-ref.supabase.co/auth/v1/callback)`
3. Copy the Google client ID and secret into Supabase Google provider settings.
4. In Supabase `Authentication > URL Configuration`, add:
   `https://<your-extension-id>.chromiumapp.org/supabase-auth`
5. Rebuild and reload the extension after changing auth settings.

Supabase handles the provider callback, then redirects back into the Chrome extension through `chrome.identity.launchWebAuthFlow`.

## Local development

Run the Vite dev server:

```bash
npm run dev
```

This is useful for UI iteration, but the real timer/background/OAuth behavior should be tested in the loaded extension.

## Build the extension

```bash
npm run build
```

The production extension output is written to `dist/`.

## Load into Chrome

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click `Load unpacked`
4. Select the `dist` folder
5. Copy the generated extension ID and add the redirect URL described above in Supabase
6. Reload the extension after any `dist` rebuild

## How to test

### Signup/login

1. Open the extension popup.
2. Create an account with email/password.
3. Log out from Settings and log back in.
4. Test `Continue with Google`.

### Timer persistence

1. Start a stopwatch or timer from the Log tab.
2. Close the popup.
3. Wait at least 10-20 seconds.
4. Reopen the extension and verify the time stayed accurate.

### Timer completion

1. Start a short timer.
2. Close the popup.
3. Let it expire.
4. Reopen the popup and confirm the completion toast appears and the session shows in History.

### Always-visible mode

1. Open Settings.
2. Turn on the always-visible toggle.
3. Confirm the Chrome side panel opens with live timer controls.

## Share or deploy

For personal use or manual sharing, distribute the built `dist` folder and the setup steps above.

For broader distribution:

1. Create a stable extension ID by packaging with a consistent Chrome extension key.
2. Update the Supabase redirect URL with that stable extension ID.
3. Package and publish to the Chrome Web Store.

## Project structure

```txt
public/
  icons/
  sounds/
src/
  background/
  components/
  lib/
  offscreen/
  sidepanel/
  test/
  types/
manifest.json
```

## Notes

- The extension never uses the Supabase service role key.
- Only the anon key is used in the frontend and background save flow.
- Timer completion audio is best-effort. Browser audio policies can still affect playback in unusual environments.
