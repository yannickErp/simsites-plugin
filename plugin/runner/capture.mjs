// Capturing the running app: screenshots (desktop and phone), visible text, controls and the computed look of each
// route, into a feature's references/ folder. Runs where the app is reachable — the developer's machine, from the
// simsites CLI — so the hosted SimSites never needs to reach anyone's localhost. The local Studio uses it too.
import { promises as fs } from "node:fs";
import path from "node:path";
import { launchChromium } from "./chromium.mjs";

/** Dev-server overlays (the Next.js dev indicator, Vite's error overlay) aren't part of the app. */
export const DEV_OVERLAYS = "nextjs-portal,#__next-build-watcher,vite-error-overlay{display:none!important}";

/** The app redirected a protected page to its sign-in page (e.g. /dashboard → /login?next=…). */
export function signInRedirect(route, url) {
  const to = new URL(url).pathname;
  return to !== route.split("?")[0] && /(^|\/)(log-?in|sign-?in|auth|session|account\/login)(\/|$)/i.test(to);
}

/**
 * Pages the request names that the linked routes leave out ("on the about page", "/settings/team"), when the dev
 * server answers them: a feature for /about should be designed from /about, even if the repo was linked with / only.
 * @param {string} request @param {{ devUrl: string, routes: string[] }} repo
 */
export async function routesNamedIn(request, repo) {
  const text = request.toLowerCase();
  const guesses = new Set();
  for (const m of text.matchAll(/(?:^|[\s(`"'])(\/[a-z0-9][a-z0-9/_-]*)/g)) guesses.add(m[1].replace(/\/+$/, ""));
  for (const m of text.matchAll(/\b(?:the|our|my)\s+([a-z][a-z-]{2,30})\s+(?:page|screen)\b/g)) guesses.add("/" + m[1]);
  const out = [];
  for (const route of guesses) {
    if (repo.routes.includes(route) || out.length >= 3) continue;
    // Never open endpoints or pages that act on load (signing out would end the saved session).
    if (/^\/(api|_next|static|assets)\b|(^|\/)(log-?out|sign-?out|auth|callback)(\/|$)/i.test(route)) continue;
    // A redirect may be a sign-in page in front of the screen: capture reports it as such.
    const res = await fetch(repo.devUrl + route, { redirect: "manual", signal: AbortSignal.timeout(8000) }).catch(() => null);
    if (res && res.status >= 200 && res.status < 400) out.push(route);
  }
  return out;
}

/** Scroll through the page once so sections that fade in on scroll and lazy images are shown in a full-page shot. */
async function revealPage(page) {
  await page
    .evaluate(async () => {
      const step = window.innerHeight * 0.8;
      for (let y = 0; y < Math.min(document.documentElement.scrollHeight, 6000); y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
    })
    .catch(() => {});
  await page.waitForTimeout(800);
}

/**
 * The app's look as the browser computes it: fonts, the colours that cover the most area, text colours, radii and
 * what its buttons and inputs look like. Runs in the page. Sims copy these values instead of guessing from pixels.
 */
function probeLook() {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.top < innerHeight * 2;
  };
  const els = [...document.body.querySelectorAll("*")].filter(visible).slice(0, 1500);
  const area = new Map();
  const text = new Map();
  const radii = new Map();
  const fonts = new Map();
  const add = (m, k, n = 1) => m.set(k, (m.get(k) ?? 0) + n);
  for (const el of els) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (cs.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)) add(area, cs.backgroundColor, r.width * r.height);
    if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) {
      add(text, cs.color);
      add(fonts, `${cs.fontFamily.split(",")[0].replace(/["']/g, "")} ${cs.fontSize}/${cs.fontWeight}`);
    }
    if (cs.borderRadius && cs.borderRadius !== "0px") add(radii, cs.borderRadius);
  }
  const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
  const canvas = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const hex = (c) => {
    let m = /^rgba?\(/.test(c) ? c.match(/\d+(\.\d+)?/g) : null;
    // oklch(), lab(), color(srgb …) (Tailwind v4): let a 1×1 canvas convert it to sRGB.
    if (!m && canvas) {
      canvas.clearRect(0, 0, 1, 1);
      canvas.fillStyle = "#000";
      canvas.fillStyle = c;
      canvas.fillRect(0, 0, 1, 1);
      const d = canvas.getImageData(0, 0, 1, 1).data;
      m = [String(d[0]), String(d[1]), String(d[2]), ...(d[3] < 255 ? [String(Math.round((d[3] / 255) * 100) / 100)] : [])];
    }
    if (!m) return c;
    const [r, g, b, a] = m.map(Number);
    const h = "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
    return a !== undefined && a < 1 ? `${h} (alpha ${a})` : h;
  };
  const body = getComputedStyle(document.body);
  const describe = (sel, what) => {
    const el = [...document.querySelectorAll(sel)].find(visible);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return `- ${what} ("${(el.innerText || el.placeholder || "").trim().slice(0, 24)}"): background ${hex(cs.backgroundColor)}, text ${hex(cs.color)}, ${cs.fontSize} ${cs.fontWeight}, padding ${cs.padding}, radius ${cs.borderRadius}, border ${cs.borderWidth} ${hex(cs.borderColor)}, height ${Math.round(el.getBoundingClientRect().height)}px`;
  };
  return [
    `- Body font: ${body.fontFamily} · ${body.fontSize} · text ${hex(body.color)} on ${hex(body.backgroundColor)}`,
    `- Text styles in use (font size/weight): ${top(fonts, 6).join(" · ")}`,
    `- Background colours by area: ${top(area, 6).map(hex).join(", ")}`,
    `- Text colours: ${top(text, 5).map(hex).join(", ")}`,
    `- Corner radii: ${top(radii, 4).join(", ") || "none"}`,
    describe("button, [role=button], a.btn, .btn", "A button"),
    describe("input:not([type=hidden]), textarea", "An input"),
  ].filter((l) => !!l);
}

/**
 * @typedef {{ route: string, file: string }} Screen
 * @typedef {{ at: string, devUrl: string, total: number, reached: number, failed: { route: string, error: string }[], screens?: Screen[] }} CaptureResult
 */

/**
 * Capture routes of the running app into `dir` (references/): app-N.jpg, app-N-phone.jpg, notes.md and capture.json.
 * With `add`, only those routes, appended to the capture `before` (a sim that starts on a screen not captured yet).
 * @param {{
 *   chromium: import("playwright").BrowserType,
 *   dir: string,
 *   repo: { path: string, devUrl: string },
 *   routes: string[],
 *   storageState?: string,
 *   add?: boolean,
 *   before?: CaptureResult | null,
 *   log?: (s: string) => void,
 * }} o
 * @returns {Promise<CaptureResult>}
 */
export async function captureScreens(o) {
  const { chromium, dir, repo, routes, storageState, log = () => {} } = o;
  const before = o.add ? (o.before ?? null) : null;
  await fs.mkdir(dir, { recursive: true });
  // Screenshots are numbered by route: an older capture's files would label the wrong screens.
  if (!o.add) for (const f of await fs.readdir(dir)) if (/^app-\d+(-phone)?\.jpg$/.test(f)) await fs.rm(path.join(dir, f), { force: true });
  const offset = before ? Math.max(0, ...(before.screens ?? []).map((x) => Number(/app-(\d+)/.exec(x.file)?.[1] ?? 0)), before.total) : 0;
  const notes = ["# The existing app", "", `Source: ${repo.path}`, `Running at: ${repo.devUrl}`, ""];
  let reached = 0;
  const lookNotes = [];
  const failed = [];
  const screens = [];
  const browser = await launchChromium(chromium);
  try {
    // Signed-in apps: capture with the developer's saved session (`simsites login`).
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState });
    // Phone sims are drawn from the app's real phone layout, not guessed from the desktop one.
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, storageState });
    for (const [i, route] of routes.entries()) {
      const url = repo.devUrl + route;
      log(`Capturing ${url}`);
      const page = await ctx.newPage();
      try {
        // A page that never goes network-idle (a live stream) is fine once loaded; a refused connection is a failure,
        // not a screenshot of the browser's error page.
        const res = await page.goto(url, { waitUntil: "networkidle", timeout: 25000 }).catch(async (err) => {
          if (/net::ERR_/.test(String(err))) throw err;
          await page.waitForLoadState("load");
          return null;
        });
        await page.addStyleTag({ content: DEV_OVERLAYS }).catch(() => {});
        await revealPage(page);
        if (res && res.status() >= 400) failed.push({ route, error: `HTTP ${res.status()}` });
        if (signInRedirect(route, page.url())) failed.push({ route, error: `redirected to sign-in (${new URL(page.url()).pathname}) — run \`simsites login\`` });
        // A sign-in page or an error page isn't what the route looks like: no screenshot of it at all, or it would be
        // taken for the screen.
        const failure = failed.find((f) => f.route === route);
        if (failure) {
          notes.push(`## ${route}`, `Not captured: ${failure.error}. Read the code for how this screen looks.`, "");
          reached++;
          continue;
        }
        const name = `app-${offset + i + 1}.jpg`;
        const height = await page.evaluate(() => document.documentElement.scrollHeight);
        await page.screenshot({ path: path.join(dir, name), type: "jpeg", quality: 72, fullPage: height <= 2700 });
        screens.push({ route, file: name });
        const text = (await page.evaluate(() => document.body.innerText)).replace(/\n{3,}/g, "\n\n").slice(0, 1500);
        const controls = await page.$$eval("button, a[href], input, textarea, select, [role=button]", (els) =>
          els.slice(0, 50).map((el) => {
            const label = (el.innerText || el.getAttribute("aria-label") || el.placeholder || el.getAttribute("href") || "").trim().replace(/\s+/g, " ").slice(0, 60);
            const sim = el.getAttribute("data-sim");
            return `${el.tagName.toLowerCase()}${el.type ? `[${el.type}]` : ""} "${label}"${sim ? ` data-sim="${sim}"` : ""}`;
          }),
        );
        const phoneName = `app-${offset + i + 1}-phone.jpg`;
        const phoneShot = await phone
          .newPage()
          .then(async (pp) => {
            try {
              await pp.goto(url, { waitUntil: "networkidle", timeout: 20000 }).catch(() => pp.waitForLoadState("load"));
              await pp.addStyleTag({ content: DEV_OVERLAYS }).catch(() => {});
              await revealPage(pp);
              const h = await pp.evaluate(() => document.documentElement.scrollHeight);
              // Long pages: the first ~4 screens, where most phone sims happen.
              await pp.screenshot({ path: path.join(dir, phoneName), type: "jpeg", quality: 72, fullPage: true, clip: { x: 0, y: 0, width: 390, height: Math.min(h, 3400) } });
              return true;
            } finally {
              await pp.close();
            }
          })
          .catch(() => false);
        if (!lookNotes.length) lookNotes.push(...(await page.evaluate(probeLook).catch(() => [])));
        notes.push(
          `## ${route}`,
          `Screenshot: ${name}${res ? ` (HTTP ${res.status()})` : ""} · title: ${await page.title()}`,
          ...(phoneShot ? [`On a phone (390×844): ${phoneName}`] : []),
          "",
          "Visible text (excerpt):",
          "```",
          text,
          "```",
          "Controls:",
          ...controls.map((c) => `- ${c}`),
          "",
        );
        reached++;
      } catch (err) {
        const error = String(err).split("\n")[0];
        failed.push({ route, error });
        notes.push(`## ${route}`, `Could not capture ${url}: ${error}`, "");
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  const file = path.join(dir, "notes.md");
  const prev = await fs.readFile(file, "utf8").catch(() => "");
  let capture;
  if (before) {
    // Added screens go at the end of notes.md; the capture lists them with the earlier ones.
    await fs.writeFile(file, prev.trimEnd() + "\n\n" + notes.slice(5).join("\n") + "\n");
    capture = {
      ...before,
      total: before.total + routes.length,
      reached: before.reached + reached,
      failed: [...before.failed.filter((x) => !routes.includes(x.route)), ...failed],
      screens: [...(before.screens ?? []).filter((x) => !routes.includes(x.route)), ...screens],
    };
  } else {
    if (!reached) notes.push("The dev server was not reachable — rely on reading the source code for the look and the screens.", "");
    if (lookNotes.length) notes.splice(5, 0, "## The app's look (computed in the browser)", "", ...lookNotes, "");
    await fs.writeFile(file, notes.join("\n") + "\n" + (prev ? "\n" + prev : ""));
    // What the CLI shows the user: a capture that reached nothing means the sims are drawn from code alone.
    capture = { at: new Date().toISOString(), devUrl: repo.devUrl, total: routes.length, reached, failed, screens };
  }
  await fs.writeFile(path.join(dir, "capture.json"), JSON.stringify(capture, null, 2) + "\n");
  return capture;
}
