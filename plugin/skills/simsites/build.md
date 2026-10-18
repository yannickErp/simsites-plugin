# Building an approved feature

Read from `/simsites` once every sim is approved (or when the user asks to build a feature approved earlier).
Build it into this repository:

1. **Hand off**: `simsites handoff --project <id>` (the feature's id — `simsites list` shows them; without it the repo's
   current feature) — add `--drafts` only if the user asked to build unapproved simulations. Use the same `--project` for
   `simsites progress`, `verify` and `fixes`.
   It writes `.simsites/<feature>/` and prints the folder. If nothing is approved yet, tell the user and stop.
2. **Look at the sims first.** For every sim, Read `sims/<id>/sim.jpg` (the whole sim on one sheet), then each
   image in `sims/<id>/frames/` in order (with `sims/<id>/FRAMES.md` beside it) and `sims/<id>/feedback.md` if present. This is exactly what the user watched and
   approved, so build what you see. Tell the user in a few lines what you saw on each sim.
3. **Read the bundle**: `BUILD.md` (the rules), `brief.md`, `decisions.md`, `manifest.json` (use cases + steps),
   `sims/<id>/steps.json`, and `SPEC.md` / `sims/<id>/backend.json` if present. Use `sims/<id>/scene.html` for exact
   copy, colours and sizes; when it and the frames disagree, the frames win.
4. **Study this repo** where the feature lives: routing, layout, components, styling, data layer, existing API.
5. **Implement** each use case the way this codebase already works (follow BUILD.md). The user watches the build on the
   Review page: at each milestone send one short note, e.g. `simsites progress "Adding the invite dialog to
   TeamSettings.tsx"` (what, and where — 4–10 words).
   - put `data-sim="<target>"` on the real element for every step target (inputs carry it themselves; click targets
     are real buttons/links; `expect` targets become visible after the action; drop zones — the `to` of a drag step —
     carry their id too);
   - persist data through the app's real backend; show the error states the simulations show;
   - check `.simsites/<feature>/routes.json` (handoff pre-fills each use case's start path; fix any that's wrong).
   Keep the change focused; don't refactor unrelated code. Run the project's own typecheck/lint/tests if it has them.
   The approved sims are the spec: build each control as the sim draws it (a custom menu stays a custom menu; reuse
   the app's component when it has one); never edit them to match your code and never make the UI worse to get a step to
   pass. A sim that is impossible as drawn, or a step verify can't replay → tell the user; change a sim only with
   their OK (then it needs their approval again).
6. **Verify**: make sure the dev server is running (start it in the background with the `devCommand` from
   `.simsites/config.json` if needed), then `simsites verify`. If flows fail, read `.simsites/<feature>/VERIFY.md`,
   fix the app (not the simulations), and verify again — up to 4 rounds.
   Once steps pass, do the visual pass: `VERIFY.md` pairs each approved frame with your app's screenshot of the same
   moment — `verify/<sim>/<step>-pair.jpg` shows both side by side (sim left, app right). Read every pair and fix
   what looks different, then verify again. Steps that pass can still
   look wrong: `verify` lists them with a match score (⚠). A low match on every step usually means the dev server
   hasn't picked up your new CSS; "moved or resized" names the ids whose box differs from the sim.
   Then `simsites verify --all` when the repo has other features (`simsites list`): a failing older sim is a
   regression (fix the app) or an intended change (tell the user; update that sim only with their OK). An older sim
   that passes but looks different (⚠): read its lowest pair; if your change caused it, name that sim to the user.
7. Report what you built, the files changed, and the final verify results. Mention anything you couldn't match.
   Commit `.simsites/<feature>/` with the code when the user commits — and `.simsites/design/<feature>/` for a feature
   designed in Claude Code: the approved sims are the regression suite that `simsites verify --all` replays later
   (on another clone, `simsites pull --project <id>` brings a feature's design folder over first) (verify's own output — `verify/`, `VERIFY.md`, `verify-report.json` — is git-ignored).
8. Stay reachable: the user now compares the built app with the sims on the Review page (Built vs approved) and may
   comment on a pair. Start `simsites wait --until fixes --project <id> --json` as a background command; when it
   returns with fix requests, fix them, `simsites verify`, `simsites fixes --done <id>`, tell the user, and wait again.
