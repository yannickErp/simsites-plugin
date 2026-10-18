// Launch Chromium for the Studio, the render worker and the CLI (lib/chromium.mjs re-exports this; it ships with the plugin).
// Playwright looks for the exact browser build it was released with. When that build isn't downloaded (offline
// machines, sandboxes, a Playwright update without `playwright install`), use another Chromium that is installed:
// SIMSITES_CHROMIUM if set, else the newest build in Playwright's browser folders, else a system Chrome/Chromium.
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const BUILD_DIRS = () =>
  [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    path.join(homedir(), ".cache", "ms-playwright"),
    path.join(homedir(), "Library", "Caches", "ms-playwright"),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "ms-playwright"),
  ].filter((d) => d && d !== "0" && existsSync(d));

// Executables inside a build folder, across Playwright versions and platforms.
const INSIDE = [
  "chrome-headless-shell-linux64/chrome-headless-shell",
  "chrome-linux/headless_shell",
  "chrome-headless-shell-mac-arm64/chrome-headless-shell",
  "chrome-headless-shell-mac-x64/chrome-headless-shell",
  "chrome-headless-shell-win64/chrome-headless-shell.exe",
  "chrome-linux64/chrome",
  "chrome-linux/chrome",
  "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
  "chrome-win64/chrome.exe",
  "chrome-win/chrome.exe",
];

const SYSTEM = [
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];

/** Another installed Chromium, newest first; headless shells first unless a window is needed. */
export function findInstalledChromium(headless = true) {
  if (process.env.SIMSITES_CHROMIUM && existsSync(process.env.SIMSITES_CHROMIUM)) return process.env.SIMSITES_CHROMIUM;
  const builds = [];
  for (const dir of BUILD_DIRS()) {
    for (const name of readdirSync(dir)) {
      const m = /^chromium(_headless_shell)?-(\d+)$/.exec(name);
      if (m) builds.push({ dir: path.join(dir, name), shell: !!m[1], n: Number(m[2]) });
    }
  }
  builds.sort((a, b) => (headless ? Number(b.shell) - Number(a.shell) : Number(a.shell) - Number(b.shell)) || b.n - a.n);
  for (const b of builds) {
    if (!headless && b.shell) continue;
    for (const rel of INSIDE) {
      const exe = path.join(b.dir, rel);
      if (existsSync(exe)) return exe;
    }
  }
  return SYSTEM.find((p) => existsSync(p)) ?? null;
}

/**
 * chromium.launch(opts), falling back to another installed Chromium when Playwright's own build is missing.
 * @param {import("playwright").BrowserType} chromium
 * @param {import("playwright").LaunchOptions} [opts]
 * @returns {Promise<import("playwright").Browser>}
 */
export async function launchChromium(chromium, opts = {}) {
  if (process.env.SIMSITES_CHROMIUM) return chromium.launch({ ...opts, executablePath: process.env.SIMSITES_CHROMIUM });
  try {
    return await chromium.launch(opts);
  } catch (err) {
    if (!/Executable doesn't exist|browserType\.launch: .*not found/i.test(String(err?.message))) throw err;
    const exe = findInstalledChromium(opts.headless !== false);
    if (!exe) throw err;
    return chromium.launch({ ...opts, executablePath: exe });
  }
}
