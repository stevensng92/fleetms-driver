---
name: preview-driver-app
description: Launch the FleetMS Driver app in the browser preview pane (Expo web served by Metro on port 8081). Use when asked to run, preview, bring up, or screenshot the app, or to verify a change in the running app.
---

# Preview the FleetMS Driver app

Expo SDK 54 + expo-router app. `app.json` has `web.output: "single"`, so plain
`expo start` serves the web build straight from Metro at `http://localhost:8081`
— no `--web` flag needed (that flag only adds an auto-open of the user's real
browser, which we don't want).

## 1. Cold-start a worktree (skip in the main checkout)

Worktrees start without `.env` or `node_modules`. Both come from the main
checkout at `C:\github\fleetms-driver`:

```bash
cp C:/github/fleetms-driver/.env .env
```

`.env` is gitignored on purpose (public repo — never commit it). It carries
`EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` and friends;
without it `lib/supabase.ts` throws at import time and nothing renders.

```powershell
New-Item -ItemType Junction -Path "node_modules" -Target "C:\github\fleetms-driver\node_modules"
```

The junction needs no admin rights and Metro bundles through it fine. It is
safe as long as the worktree's `package-lock.json` matches the main checkout's
— diff them first if the branch touched dependencies, and run `npm ci` instead
when they differ.

`google-services.json` is also absent in a worktree; the web build never needs
it.

## 2. Launch config

Ensure `.claude/launch.json` (untracked) exists with exactly:

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "fleetms-driver-web",
      "runtimeExecutable": "npx",
      "runtimeArgs": ["expo", "start", "--port", "8081"],
      "port": 8081
    }
  ]
}
```

If port 8081 is already listening (another checkout's Metro), pick a free port
and change both `--port` and `port`.

## 3. Start and verify

1. `preview_start` with name `fleetms-driver-web`. The tab opens immediately,
   but Metro takes ~30–60s to start plus more for the first web bundle.
2. `resize_window` to the `mobile` preset — it's a phone app; desktop width
   renders it stretched. Reset to `desktop` when done.
3. Wait, then **screenshot and look at it**. Don't re-`navigate` to
   `http://localhost:8081` once the tab already shows it — same-URL navigation
   is refused as a no-op; just wait and screenshot again.
4. Success looks like the dark sign-in screen: FleetMS logo, "Sign in to start
   your shift", phone + 6-digit PIN fields, version number at the bottom.
   A blank frame means Metro is still bundling (check `preview_logs` — a
   healthy start shows `env: load .env` with the `EXPO_PUBLIC_*` exports,
   then `Starting Metro Bundler`).

## 4. Past the sign-in screen

Auth is a real driver phone number + PIN against prod Supabase. One dev
shortcut exists: `lib/devSession.ts` silently signs in on cold start when
BOTH `EXPO_PUBLIC_DEV_DRIVER_EMAIL` and `EXPO_PUBLIC_DEV_DRIVER_PASSWORD`
are set in `.env` (see README's env section for the linked-driver-row
requirement). If either is missing you get the real sign-in screen — ask the
user to sign in themselves in the pane (or to fill in the dev credentials)
before driving authenticated screens. Never write credential values into any
committed file; this repo is public.
