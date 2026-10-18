---
name: verify
description: Replay every approved SimSites flow of the current feature in a real browser against the running dev server, and fix what fails.
allowed-tools: Bash(simsites *) Bash(curl *)
---

1. Make sure the dev server from `.simsites/config.json` is running (start it in the background with its
   `devCommand` if `curl` gets no answer).
2. Run `simsites verify --project <id>` (`simsites list` shows the features; the "current" one is whichever was started
   last, maybe by another session). It replays each approved simulation's steps (click, dblclick, upload, type, hover, scroll, key,
   drag onto its `to` id, expect — on `data-sim` targets) starting at the route in `.simsites/<feature>/routes.json`, and — only for sims that list
   `survivesReload` ids (or have a backend.json) — reloads at the end and checks the saved data is still there.
3. Look, don't just count passes: `VERIFY.md` pairs every approved frame (`sims/<id>/frames/…`) with the app's
   screenshot of the same moment (`verify/<id>/…`). `verify` lists steps that pass but look different (⚠, with a
   layout match %); start there, read both images of each pair and note visible differences.
4. Fix requests: `simsites fixes --project <id>` lists what the reviewer asked to change after comparing the built app with the sims
   (details and screenshots in `.simsites/<feature>/FIXES.md`). Fix each in the app, verify again, then
   `simsites fixes --done <id>`.
5. If every step passes, the pairs match and no fix requests are open, say so. If not, read
   `.simsites/<feature>/VERIFY.md`, show the user a short summary of what failed or looks different, and offer to fix
   it (fix the app, not the simulations), then verify again.

Every approved sim stays a test. `simsites verify --all` replays every handed-off feature of this repo — run it
before you finish a change that touches shared screens. A failing older feature is either a regression (fix the app)
or an intended change from a newer feature: then tell the user and, with their OK, update that sim — edit its scene in
`.simsites/design/<feature>/`, `simsites look <sim> --project <feature>` — and have them approve it again.

