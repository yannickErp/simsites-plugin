---
name: simsites
description: Design a UI feature of this app as short simulations (sims) of its real screens before building it — you draw the sims here, the developer watches, refines and approves them in this conversation, then you build from the approved frames. Use when the user types /simsites, wants to design, preview, mock up, simulate or spec a UI change before coding it, mentions SimSites, sims or ".simsites/", or asks to build/verify a feature handed off from SimSites.
argument-hint: <the feature you want, in plain words>
allowed-tools: Bash(simsites *) Bash(curl *)
---

# SimSites: see it first, then build it

Feature: **$ARGUMENTS**

You are the designer AND the builder. For a UI feature, you first draw it as one or more short scripted
**simulations — "sims"** — of this app's real screens (`scene.html` files played by the SimSites runtime). Always call
them sims (or simulations) when you talk to the user. The developer watches each sim, tells
you what to change, and approves it. Then you build exactly what was approved and `simsites verify` replays every
sim's steps against the running app. SimSites (a website the `simsites` CLI talks to) renders and checks the sims, builds the hand-off,
and gives the developer the watch page where they see and approve each sim; the CLI captures the app and verifies
the build on this machine.

If no feature was given above and the conversation has none, ask what they want to build and stop.
- A Linear issue id as the feature (`ENG-42`) → it's the brief: start with `simsites design --json --issue ENG-42` (add
  what you learnt from the code as the feature text if useful). "What's waiting?" → `simsites next` lists issues the team
  labelled for sims.
- "Where are we?" → `simsites status` and `simsites sims` (with `--project <id>` when `simsites list` shows several
  features): say in a few lines which sims are drawn, approved or waiting, the comments waiting (`simsites inbox`), and
  end with the watch link.
- Build or verify something already approved → skip to **6. Build**.
- "What does this screen do today?" / a baseline before changing it → the same flow with `simsites design "<what>"
  --map /route,/route`: sim what those screens do now (no new UI), get it approved, hand it off; verify then keeps it.

## 1. Set up (silent unless something is missing)

- Nothing to start: SimSites is a website. A command that says "Sign in to SimSites first" → tell the user to make a
  token on SimSites' settings page and run `simsites auth <token>` themselves, then stop. The first capture or verify
  on a machine installs Playwright (a minute, once).
- `.simsites/config.json` missing → `simsites init` (add `--routes /a,/b` for screens the feature touches; dynamic
  routes need a concrete path; `--routes` replaces the list, so keep the existing ones). Signed-in screens → `simsites login /login` and let the user sign in themselves.
- The dev server must answer: `curl -s -o /dev/null -w "%{http_code}" <devUrl>`; if not, start `devCommand` from the
  config in the background and wait for it.

## 2. Understand, ask once

Read the code of the screens the feature touches (routes, components, styling, data). Then decide what you'd sim.
If something would visibly change the sims (where it lives, who can do it, what happens on an error, content only
the user can provide), ask it — **at most 3 questions in ONE AskUserQuestion call**, each with 2–4 short options and
your recommendation first. Tiny features: no questions. Never ask about things you can decide sensibly yourself; list
them later as assumptions.

## 3. Start the design

`simsites design --json --title "<the feature's name, 2–5 words>" "<the request in the user's words + what you learnt>"`
(add `--ref <file>,…` for mockups or screenshots the user gave you) → returns `designDir` (`.simsites/design/<id>/`), the
screenshots it just took, and `id`. Pass `--project <id>` to
every later command (other sessions may run other features).

Read `CONTRACT.md` (the scene rules), `references/notes.md` (each screen's text, controls, existing data-sim ids and
the app's computed fonts/colours/radii) and the screenshots of the screens you'll sim. Read
[example-scene.html](example-scene.html) once (a whole sim: a composer that opens, typed text in a focused input, a
toast, a list item sliding in, counters that update) and use [patterns.md](patterns.md) for tested snippets: dialogs,
side panels, dropdowns, typing with a caret, rows added/removed, toasts, validation errors, tooltips, key presses,
drag and drop, scrolling, phone.

Write, in the design folder:
1. `style/tokens.css` + `style/components.css` — reproduce the existing app: copy values from its real CSS/theme files
   (and notes.md), class names after what they are. A sim that doesn't look like the app is the most common failure.
   If `design` returned `styleFrom` (`style/FROM.md` exists), they were copied from an earlier feature of this app:
   reuse and extend them; fix only what no longer matches the app — don't start them over.
2. `plan.json` (with `"assumptions"`: every decision you made without asking, as in CONTRACT.md — the watch page (Details)
   shows them and lets the developer change one) and `usecases.json` — **one sim per goal**: a goal is what a user
   would say in one sentence ("invite a teammate", "delete a task"). Don't chain separate goals into one long sim; don't split one goal into several.
   Typical: a tweak or one flow → 1 sim; a few related flows (edit / comment / delete) → 2–4; a new area → 4–6.
   Cover the main flow, then the most important error or alternative flow as its own sim (an invalid email, a name
   that's taken) — don't fold the error into the happy path, so each sim shows one outcome.
   A sim stays 8–20s and under ~10 steps. The first step of each use case opens a real route.
   A goal that needs data the app doesn't have yet (unblocking needs a blocked task) still gets its own sim: give that
   use case its own `"startingData": "<one sentence: the records this flow needs>"` in usecases.json; when building,
   the repo's reset command seeds it for that flow (verify runs `resetCommand` with `SIMSITES_FLOW=<sim id>` before each sim) — or, for data the app keeps in the
   browser, its routes.json entry `{ "path": "/", "localStorage": { … } }`. Never add test-only switches to the app.
   When something must be saved (it should still be there after a reload), list the data-sim ids that prove it in the
   use case: `"survivesReload": ["note-n2-pinned"]` — verify reloads the page at the end of the flow and checks them.

## 4. Draw a sim, look at it, fix it — before the user sees it

Write `sims/<id>/scene.html` (first sim first: it sets the design; later sims reuse its markup, classes, copy and
ids exactly). Then:

`simsites look <id> --project <p>` → storyboard, frames and the automatic checks, including how much the first frame
looks like the real screen it starts from. **Read `look/storyboard.jpg`** and judge like a picky reviewer:
- Does it look like the app? When a check says the first frame matches the app today at only N%, Read
  `look/app-today.jpg` next to `look/00-start.jpg` (phone: `look/app-today-phone.jpg` next to `look/m-00-start.jpg`)
  and fix the differences (sidebar, header, spacing, fonts, data).
- Is every step visible and readable? Text cut off, overlapping, off-screen? Does the result stay on screen ~1.5s?
- Fix every ✗ check. Fix ⚠ unless it's deliberate — and look before deciding: a ⚠ you keep gets one line to the user
  saying why (e.g. "the sidebar differs from today's app because this feature restyles it"), never "I haven't looked".

Phones: the default layout is always desktop (`viewport: [1440, 900]`); the phone is the `mobile` variant
(`variants: ['default', 'mobile']`, drawn for 390×844 via `h.variant`, see patterns.md) — also when the phone matters
most. `look` then renders `storyboard-mobile.jpg` and compares its first frame with the app's phone screenshot.

Changed `style/` (shared by every sim)? `simsites look --all` re-renders and checks them all, one line each.

A taste request with no clear answer ("make it nicer", "cleaner", "more modern"): draw your best proposal, then one
clearly different direction as take 2 of the same sim (copy scene.html to `take-2.html`, change it,
`simsites look <sim> --take 2`), and let the user pick — that is what seeing it first is for. Their pick:
`simsites keep <sim> 2` (it becomes the sim — never copy a take over scene.html yourself), or with their approval
`simsites approve <sim> --take 2`.

Repeat edit → look until it has no ✗, you'd be happy to show it, and it scores ≥ 90 — or every ⚠ left is one you keep on
purpose and explain to the user (usually 1–3 rounds). For small text, labels and states, run `simsites show <sim> --zoom` and Read `look/zoom.jpg` (each
step's target at full size, one sheet).

## 5. Show it, refine it, approve it — in this conversation

Show the developer each sim as soon as it's good — **the watch link is how they see it**:
- The watch page (the link `look` prints as `watch`; one link for the whole feature is the `watch` link without `?sim=`)
  plays each sim large after a title card, with its steps, **Approve**, and a box to say what to change (they can point
  at an element). It steps through the sims and moves on after each approval. `simsites show` opens it for them.
- In chat: a short storyboard per sim — its title, then one line per frame ("1. Settings → Team: 3 members, **Invite**
  button top right · 2. Click Invite → dialog with email + role · …") — then the assumptions you made.
- **The watch link is always the last line of your message** whenever sims are drawn or changed or waiting for a
  decision: `▶ [Watch and approve the sims](<the feature's watch link, as look prints it>)` — nothing after it.
- Don't send GIFs or storyboards into the chat — they're too small to judge. Only when the user asks for an image:
  `look/storyboard.jpg` or `simsites show <sim> --gif`.
- **Never ask for approval with AskUserQuestion** — an open question blocks this conversation, so what the user does
  on the watch page can't reach you until they answer it (a hook refuses such questions while sims wait). Instead,
  **listen and reply in plain text**:
  1. Start `simsites wait --until decision --json --project <id>` **in the background** (run_in_background) before
     you end your turn. It returns on the first thing the user does on the watch page: `reason: "feedback"` (a
     comment), `"decision"` (some sims approved or taken back: `newlyApproved`, `unapproved`, `waiting`) or
     `"approved"` (all of them). While it runs, the watch page tells the user Claude Code is listening.
  2. End the reply with one plain line — "Approve them on the watch page, or tell me here which are ready or what to
     change" — then the watch link as the last line.
  3. When the wait returns: feedback → apply it as below; decision → one short line ("Approved: invite flow — 1 sim
     left") and start the wait again; approved → build right away (the watch page tells them they can come back to
     you). A timeout → start it again. If the user writes here instead, answer them and keep (or restart) the wait.
  Approvals in the chat work too — "approve the first two" — but only explicit ones (see Rules).

Not sure which element the user means ("the button on the right")? `simsites show <sim> --labels [--at <s>]` draws
numbered badges on every element of a frame (`look/labels.jpg` + a legend): show it and let them answer "#3".

On a change request: edit the scene (keep data-sim ids — they're a contract), then
`simsites look <sim> --note "<what changed, one sentence>"`, read the new storyboard, and show it again with what
changed. `look/compare.jpg` (`compare-mobile.jpg` for the phone layout) shows only the frames your change touched,
before | after — read it to confirm the change did what was asked and nothing else (it catches changes that leak into
other frames or layouts). Anything else that changed is yours to fix before you show it (find why — usually a shared
class or a height that moved), then `look` again. The sheet holds the first 4 changed frames; if more changed, also
compare the `before` storyboard `look` lists with the new one. Show the sheet to the user when you can show images.
"Undo" → `simsites undo <sim>` then `look` again.

- **Pull requests:** commit `.simsites/<feature>/` (the hand-off) with the code. If the team connected GitHub, the PR gets
  the sims and a SimSites check that needs every sim approved and a verify of the PR's head commit — run
  `simsites verify` on a clean checkout after your last commit (or the team's CI does it).
- **Someone else should see it** (a PM, a designer, a client) → `simsites share` prints a link: anyone with it watches,
  comments and approves without an account (`--watch-only`: watch only). Teammates in the feature's team see it already.
  Their comments and approvals reach you like the developer's, with their name.
- **Watch / approve on SimSites** → the watch link (`simsites show <sim>` opens it; in an app with a preview/browser
  pane, open the URL there). `--video` also exports an MP4.
- **The full Review page** (`simsites show --review`, under Details on the watch page): frame strip, Today vs Proposed, pointing
  at elements to comment, takes, assumptions. Comments made there come to you: run `simsites wait --until decision --json` **in the
  background**; when it returns `reason: "feedback"`, apply each request (`simsites inbox` lists them with where they
  pointed), `simsites look <sim> --note "…" --reply <ids>`, tell the user, and start the wait again — after closing
  every item (`--reply`, or `simsites inbox --done <ids>` for ones that need no sim change): the wait returns at once
  while any is open. A take request ("kind": "take", number N): copy scene.html to `take-N.html`, make the alternative, `simsites look <sim> --take N`.
  A "make" request (from "+ Simulate" on a suggested flow, or "Ask Claude Code for another sim" — then it has no sim):
  add the step to that sim, or a short new sim (a new entry in usecases.json + its scene, same design as the
  others), then `look` it with `--reply <id>`. A "decision" item (an assumption changed on the Review page): update
  that assumption in plan.json and every sim it affects, then `look` each with `--reply <id>`.
- Notes starting with **"SimSites (<feature>):"** may appear in your context when the user writes (a plugin hook): they
  are comments or approvals made on the Review page since the last message. (At session start, a note lists features
  still in flight — mention it only when relevant.) Answer the user first, then apply the
  comments like inbox items; when it says every sim is approved, build.
- **Approve** → `simsites approve <sim>` (a sim with takes: `--take N`, the one they chose) — only on an explicit
  approval (see Rules).

**No dead buttons:** once the sims are drawn (before asking to approve the last one), run `simsites coverage`. It lists
new controls the sims show but no sim demonstrates (a Cancel button, a second option). For each: add it to a sim
(a step, or a short extra sim if it opens a real flow), make it plain text if it's decorative, or
`simsites coverage --ignore <sim:key>,<sim:key> --note "why"` when it's obvious (Cancel closes the form). Tell the
user in one line what you decided — they approve the behaviour, not just the pixels.

When every sim is approved (`simsites sims` shows them), build right away.

## 6. Build from the approved frames

`simsites handoff --project <p>` writes `.simsites/<p>/` (every approved frame, `sim.jpg`, `BUILD.md`, steps). Then
follow [build.md](build.md) from step 2: look at the frames, implement in this codebase the way it already works
(`data-sim` on every step target, real backend, the sims' error states), check `routes.json` (handoff pre-fills
each sim's start path; fix any that's wrong), run the project's own checks, then `simsites verify` and fix the app until every flow passes and the visual pairs match.

**The approved sims are the spec.** Build each control as the sim draws it (a custom menu stays a custom menu —
reuse the app's existing component when it has one). While building, never edit an approved sim to match your code,
and never make the UI worse (a text field instead of a date picker, a native select instead of the drawn menu). If
verify can't replay something the sim shows correctly, or the sim turns out to be impossible as drawn, stop and tell the user what and why; change
the sim only with their OK (it then needs their approval again).

Then, if the repo has other features (`simsites list`), run `simsites verify --all` before reporting: your change
may have broken an older approved sim. A failure there is a regression (fix the app) or an intended change (tell the
user; that sim is updated only with their OK). Older sims that pass but "look different" (⚠): read the lowest pair
of each; if your change caused it (a new header row), name those sims to the user — they may want them updated.
Tell the user what you built and both verify results.

## Rules

- Approve only when the user says so explicitly ("approve", "looks good, build it", "skip the review"). "Use your
  judgement" or "I'm away" covers questions, not approval: draw and check every sim, then stop and leave them for the
  user's review (they can approve on the watch page too — the hook tells you).
- Never invent product facts (prices, limits, policies, legal copy, customer names) — use real copy or an obvious
  `[placeholder]` and list it as an assumption.
- Keep sims short (8–20s), one use case each, starting from a real route with the app's real data.
- `simsites help` lists the commands (`simsites list` shows this repo's features, `simsites use <id>` switches).
- A feature started by mistake: `simsites cancel --project <id>`.
- The design folder is kept in step with SimSites by the CLI: edit files there as usual, and never copy files into
  or out of it by hand. On another computer, `simsites pull` brings a feature's folder over.
- A command that fails because SimSites isn't reachable or needs its render worker: don't retry it in a loop or work
  around it. Tell the user in one line what couldn't run, and carry on with what works.
