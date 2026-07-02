# Status Window

Status Window is a Chrome extension for tracking study sessions with a cozy popup UI, Supabase authentication, subject management, stats, and a background-persistent timer.

## Stack

- Chrome Extension Manifest V3
- React + TypeScript + Vite
- Tailwind CSS
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

If you want Google sign-in to show a branded destination instead of the random Supabase project ref, set `VITE_SUPABASE_URL` to your Supabase custom domain or vanity subdomain after you configure it in Supabase.

## Chrome Web Store readiness

Status Window is designed to satisfy the current Chrome Web Store baseline:

- Manifest V3 only
- Non-persistent background logic through a service worker
- No remote executable code or CDN-loaded scripts
- Narrow host permissions scoped only to the configured Supabase project
- A single-purpose product: study timer, session tracking, and related stats

## Permission rationale

Current manifest permissions are intentionally limited:

- `storage`: saves local extension state such as timer state, settings cache, and session-scoped auth storage.
- `identity`: required for Chrome extension OAuth redirect handling with `chrome.identity.launchWebAuthFlow`.
- `alarms`: keeps timers reliable while the popup is closed.
- `sidePanel`: powers the optional always-visible timer panel.
- `offscreen`: allows completion audio to play from an offscreen document when the popup is closed.

Current host permission:

- Generated from `VITE_SUPABASE_URL`: required for Supabase auth and data APIs. No broad wildcard host access is requested.

## Supabase project setup

1. Create a new Supabase project.
2. In `Authentication > Providers`, enable Email and Google.
3. In `Authentication > URL Configuration`, add your Chrome extension redirect URL after you first load the unpacked extension:
   `https://<your-extension-id>.chromiumapp.org/`
4. Copy the project URL or branded Supabase domain and anon key into `.env`.

## SQL: schema

Run this in the Supabase SQL editor:

```sql
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  color text check (color is null or color ~ '^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$'),
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
  duration_seconds integer not null check (duration_seconds >= 0 and duration_seconds <= 21600),
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
  volume numeric not null default 0.5 check (volume >= 0 and volume <= 1),
  floating_mode_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.study_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  daily_target_minutes integer not null check (daily_target_minutes >= 1),
  hp_penalty integer not null check (hp_penalty >= 1),
  deadline_date date,
  is_paused boolean not null default false,
  created_at timestamptz not null default now(),
  constraint study_challenges_user_subject_unique unique (user_id, subject_id)
);

create table if not exists public.echo_easter_egg_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  has_seen_initial_echo boolean not null default false,
  initial_echo_branch text,
  initial_echo_seen_at timestamptz,
  initial_echo_completed boolean not null default false,
  eligible_for_10s_followup boolean not null default false,
  followup_window_started_at timestamptz,
  studied_10s_after_echo boolean not null default false,
  studied_10s_after_echo_at timestamptz,
  got_non_normal_branch boolean not null default false,
  got_normal_40_branch boolean not null default false,
  name_prompt_shown boolean not null default false,
  name_prompt_attempt_count integer not null default 0,
  submitted_name text,
  name_was_correct boolean,
  level_10_echo_pending boolean not null default false,
  level_10_echo_seen boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subjects_user_id_idx on public.subjects(user_id);
create index if not exists study_sessions_user_id_idx on public.study_sessions(user_id);
create index if not exists study_sessions_start_time_idx on public.study_sessions(start_time desc);
create index if not exists study_sessions_subject_id_idx on public.study_sessions(subject_id);
create index if not exists user_settings_user_id_idx on public.user_settings(user_id);
create index if not exists study_challenges_user_id_idx on public.study_challenges(user_id);
create index if not exists study_challenges_subject_id_idx on public.study_challenges(subject_id);
create index if not exists echo_easter_egg_state_updated_at_idx on public.echo_easter_egg_state(updated_at desc);
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
create unique index if not exists friend_requests_unique_pair_idx
on public.friend_requests (least(from_user_id, to_user_id), greatest(from_user_id, to_user_id));

create or replace function public.lock_friend_request_participants()
returns trigger
language plpgsql
as $$
begin
  if new.from_user_id <> old.from_user_id or new.to_user_id <> old.to_user_id then
    raise exception 'friend request participants cannot be changed';
  end if;

  return new;
end;
$$;

drop trigger if exists friend_requests_lock_participants on public.friend_requests;
create trigger friend_requests_lock_participants
before update on public.friend_requests
for each row
execute function public.lock_friend_request_participants();

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
using (from_user_id = auth.uid() or to_user_id = auth.uid())
with check (from_user_id = auth.uid() or to_user_id = auth.uid());

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

-- Optional presence table if you want to show "studying now" without exposing more data.
create table if not exists public.user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_online boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_presence enable row level security;

create policy "user_presence own rows"
on public.user_presence
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "user_presence readable by friends"
on public.user_presence
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.friend_requests r
    where r.status = 'accepted'
      and ((r.from_user_id = auth.uid() and r.to_user_id = user_presence.user_id)
        or (r.to_user_id = auth.uid() and r.from_user_id = user_presence.user_id))
  )
);
```

## SQL: Row Level Security

```sql
alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.study_sessions enable row level security;
alter table public.user_settings enable row level security;
alter table public.study_challenges enable row level security;
alter table public.echo_easter_egg_state enable row level security;
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

create policy "study_challenges own rows"
on public.study_challenges
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "echo_easter_egg_state own rows"
on public.echo_easter_egg_state
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
```

If you rerun policies in an existing project, add `drop policy if exists ...` first.

## SQL: account deletion helper

Add this function in the Supabase SQL editor if you want the in-extension `Delete account` button to work:

```sql
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  delete from auth.users
  where id = current_user_id;

  if not found then
    raise exception 'Account not found';
  end if;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
```

Because the app tables already reference `auth.users(id) on delete cascade`, deleting the auth user will also remove the user's profile, subjects, sessions, settings, challenges, friend requests, and presence rows.

## Security notes

- Keep the Supabase service role key on the server only. The extension should use the public anon key only.
- Require HTTPS/WSS for every extension-to-backend request. Do not add `http://` endpoints to the manifest or client config.
- Treat the extension as a tamperable client: enforce RLS, server-side input validation, and ownership checks in the database or backend.
- Add rate limits to auth, friend-request, and write-heavy endpoints if you introduce custom backend routes or Edge Functions.
- If you authenticate custom endpoints with cookies, add CSRF protection there. Supabase JS bearer-token requests do not use cookies by default.

## Privacy policy

Before submitting to the Chrome Web Store, publish the contents of [PRIVACY.md](/Users/alicejiang/Documents/GitHub/Status-Window/PRIVACY.md:1) at a public HTTPS URL and paste that URL into the developer dashboard privacy policy field.

## Reviewer notes

Use the template in [REVIEWER_NOTES.md](/Users/alicejiang/Documents/GitHub/Status-Window/REVIEWER_NOTES.md:1) when filling the Chrome Web Store "Reviewer notes" field. It includes:

- where to log in
- what the core feature is
- how to test timer, stats, subjects, challenges, and friends
- placeholders for test account credentials

## Email/password auth

1. In Supabase, enable Email provider.
2. For the smoothest extension flow, disable email confirmation while testing, or set Supabase `Authentication -> URL Configuration -> Site URL` to a normal web page you control.
3. The extension now avoids using `https://<extension-id>.chromiumapp.org/` for email confirmation links because that redirect works for Chrome Identity OAuth, not for links opened from an email client.

## Google OAuth setup

1. In Google Cloud Console, create OAuth credentials for a Web application.
2. Under Authorized JavaScript origins add:
   `http://127.0.0.1:5173`
3. Add this Authorized redirect URI:
   `[https://your-supabase-domain/auth/v1/callback](https://your-supabase-domain/auth/v1/callback)`
4. Copy the Google client ID and secret into Supabase Google provider settings.
5. In Supabase `Authentication > URL Configuration`, add:
   `https://<your-extension-id>.chromiumapp.org/`
6. Also add:
   `https://<your-extension-id>.chromiumapp.org/**`
7. Rebuild and reload the extension after changing auth settings.

Supabase handles the provider callback, then redirects back into the Chrome extension through `chrome.identity.launchWebAuthFlow`.

Google's account chooser text comes from the Supabase auth domain handling the OAuth flow. If `Choose an account to continue to <project-ref>.supabase.co` looks too rough, switch the project to a Supabase custom domain or vanity subdomain and then update `VITE_SUPABASE_URL` to match.

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
manifest.dist.json
```

## Notes

- The extension never uses the Supabase service role key.
- Only the anon key is used in the frontend and background save flow.
- Timer completion audio is best-effort. Browser audio policies can still affect playback in unusual environments.
