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
   `https://<your-extension-id>.chromiumapp.org/`
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

create index if not exists subjects_user_id_idx on public.subjects(user_id);
create index if not exists study_sessions_user_id_idx on public.study_sessions(user_id);
create index if not exists study_sessions_start_time_idx on public.study_sessions(start_time desc);
create index if not exists study_sessions_subject_id_idx on public.study_sessions(subject_id);
create index if not exists user_settings_user_id_idx on public.user_settings(user_id);
```

## SQL: Friends schema (optional – enables the Friends tab)

Run this in the Supabase SQL editor to unlock the Friends feature:

```sql
-- Friend requests table
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id   uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  constraint no_self_friend check (from_user_id <> to_user_id)
);

create index if not exists friend_requests_from_idx on public.friend_requests(from_user_id);
create index if not exists friend_requests_to_idx   on public.friend_requests(to_user_id);

-- RLS
alter table public.friend_requests enable row level security;

-- Each user can see requests they sent or received
create policy "friend_requests visible to participants"
on public.friend_requests for select
to authenticated
using (from_user_id = auth.uid() or to_user_id = auth.uid());

-- Only the sender can insert
create policy "friend_requests insert own"
on public.friend_requests for insert
to authenticated
with check (from_user_id = auth.uid());

-- Participants can update status (accept/decline)
create policy "friend_requests update by participants"
on public.friend_requests for update
to authenticated
using (from_user_id = auth.uid() or to_user_id = auth.uid());

-- Participants can delete (unfriend)
create policy "friend_requests delete by participants"
on public.friend_requests for delete
to authenticated
using (from_user_id = auth.uid() or to_user_id = auth.uid());

-- Allow friends to read each other's profiles
drop policy if exists "profiles own rows" on public.profiles;
create policy "profiles own rows"
on public.profiles for all
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "profiles readable by friends"
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1 from public.friend_requests r
    where r.status = 'accepted'
      and ((r.from_user_id = auth.uid() and r.to_user_id = profiles.id)
        or (r.to_user_id = auth.uid() and r.from_user_id = profiles.id))
  )
);

-- Allow friends to read each other's study_sessions (for today's hours + online status)
drop policy if exists "study_sessions own rows" on public.study_sessions;
create policy "study_sessions own rows"
on public.study_sessions for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "study_sessions readable by friends"
on public.study_sessions for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.friend_requests r
    where r.status = 'accepted'
      and ((r.from_user_id = auth.uid() and r.to_user_id = study_sessions.user_id)
        or (r.to_user_id = auth.uid() and r.from_user_id = study_sessions.user_id))
  )
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
2. For the smoothest extension flow, disable email confirmation while testing, or set Supabase `Authentication -> URL Configuration -> Site URL` to a normal web page you control.
3. The extension now avoids using `https://<extension-id>.chromiumapp.org/` for email confirmation links because that redirect works for Chrome Identity OAuth, not for links opened from an email client.

## Google OAuth setup

1. In Google Cloud Console, create OAuth credentials for a Web application.
2. Under Authorized JavaScript origins add:
   `http://127.0.0.1:5173`
3. Add this Authorized redirect URI:
   `[https://your-project-ref.supabase.co/auth/v1/callback](https://your-project-ref.supabase.co/auth/v1/callback)`
4. Copy the Google client ID and secret into Supabase Google provider settings.
5. In Supabase `Authentication > URL Configuration`, add:
   `https://<your-extension-id>.chromiumapp.org/`
6. Also add:
   `https://<your-extension-id>.chromiumapp.org/**`
7. Rebuild and reload the extension after changing auth settings.

Supabase handles the provider callback, then redirects back into the Chrome extension through `chrome.identity.launchWebAuthFlow`.

## Local development

Run the Vite dev server:

```bash
npm run dev
```

This starts Vite on `http://127.0.0.1:5173` when the port is free. If another local process is already using `5173`, Vite may move to a nearby port for browser development, and the auth helper will follow the current page origin automatically.

## Chrome Extension Supabase Redirect Setup

1. Run local dev with:

```bash
npm run dev
```

2. In Supabase `Authentication -> URL Configuration`, add these for local testing:

Site URL:

```txt
http://127.0.0.1:5173
```

Redirect URLs:

```txt
http://127.0.0.1:5173
http://127.0.0.1:5173/**
```

3. Load the unpacked Chrome extension.
4. Open the extension console.
5. Find the log titled `STATUS WINDOW EXTENSION REDIRECT URL`.
6. Copy the printed URL, which should look like:

```txt
https://<extension-id>.chromiumapp.org/
```

7. In Supabase, add both:

```txt
https://<extension-id>.chromiumapp.org/
https://<extension-id>.chromiumapp.org/**
```

8. Test Google login again.
9. In Google Cloud Console, if you keep origin restrictions enabled, also add the extension origin:

```txt
https://<extension-id>.chromiumapp.org
```

## Build the extension

```bash
npm run build
```

The production extension output is written to `dist/`.

## Load into Chrome

1. Run `npm run build`
2. Open `chrome://extensions`
3. Enable Developer mode
4. Click `Load unpacked`
5. Select either the project root or the `dist` folder
6. Copy the generated extension ID and add the redirect URL described above in Supabase
7. Reload the extension after any rebuild

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
