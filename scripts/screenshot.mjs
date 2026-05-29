#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const CAPTURE_SIZE = { width: 1280, height: 800 };
const WINDOW = { left: 120, top: 80, width: CAPTURE_SIZE.width, height: CAPTURE_SIZE.height };

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extPath = path.join(rootDir, 'dist');
const outPath = path.join(rootDir, 'doc', 'screenshot.png');

function requireMacOS() {
  if (process.platform !== 'darwin') {
    console.error('Screenshot capture requires macOS (screencapture).');
    process.exit(1);
  }
}

async function launchExtensionBrowser() {
  return chromium.launchPersistentContext(path.join(os.tmpdir(), `skip-wait-screenshot-${Date.now()}`), {
    channel: 'chromium',
    headless: false,
    viewport: { width: WINDOW.width, height: WINDOW.height - 140 },
    args: [
      `--disable-extensions-except=${extPath}`,
      `--load-extension=${extPath}`,
      `--window-size=${WINDOW.width},${WINDOW.height}`,
      `--window-position=${WINDOW.left},${WINDOW.top}`,
    ],
  });
}

async function getServiceWorker(context) {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker');
  return sw;
}

function normalizeCaptureSize(targetPath) {
  const probe = spawnSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', targetPath], { encoding: 'utf8' });
  const width = Number(probe.stdout.match(/pixelWidth: (\d+)/)?.[1] ?? 0);
  const height = Number(probe.stdout.match(/pixelHeight: (\d+)/)?.[1] ?? 0);
  if (width === CAPTURE_SIZE.width && height === CAPTURE_SIZE.height) return;
  const tmpPath = `${targetPath}.tmp.png`;
  const ffmpeg = spawnSync(
    'ffmpeg',
    ['-y', '-i', targetPath, '-vf', `scale=${CAPTURE_SIZE.width}:${CAPTURE_SIZE.height}:flags=lanczos`, tmpPath],
    { encoding: 'utf8' }
  );
  if (ffmpeg.status === 0 && fs.existsSync(tmpPath)) {
    fs.renameSync(tmpPath, targetPath);
    return;
  }
  if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  spawnSync('sips', ['-z', String(CAPTURE_SIZE.height), String(CAPTURE_SIZE.width), targetPath], { encoding: 'utf8' });
}

async function prepareBrowserWindow(page) {
  const cdp = await page.context().newCDPSession(page);
  const { windowId } = await cdp.send('Browser.getWindowForTarget');
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { ...WINDOW, windowState: 'normal' } });
  await page.bringToFront();
  await page.focus('body');
}

async function captureBrowserWindow(page, targetPath) {
  const cdp = await page.context().newCDPSession(page);
  const { windowId } = await cdp.send('Browser.getWindowForTarget');
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { ...WINDOW, windowState: 'normal' } });
  await page.waitForTimeout(1200);
  spawnSync(
    'osascript',
    [
      '-e',
      `tell application "System Events"
    repeat with procName in {"Google Chrome for Testing", "Chromium", "Google Chrome"}
      if exists process procName then
        tell process procName
          set frontmost to true
          set index of front window to 1
        end tell
        exit repeat
      end if
    end repeat
  end tell`,
    ],
    { encoding: 'utf8' }
  );
  await page.waitForTimeout(600);
  const { bounds } = await cdp.send('Browser.getWindowBounds', { windowId });
  const result = spawnSync(
    'screencapture',
    ['-x', `-R${bounds.left},${bounds.top},${bounds.width},${bounds.height}`, targetPath],
    { encoding: 'utf8' }
  );
  if (result.status !== 0 || !fs.existsSync(targetPath)) {
    throw new Error(
      result.stderr?.trim() ||
        'screencapture failed. Grant Screen Recording to Terminal or Cursor in System Settings → Privacy & Security → Screen Recording.'
    );
  }
  normalizeCaptureSize(targetPath);
}

if (!fs.existsSync(extPath)) {
  console.error('Run npm run build first. dist/ not found.');
  process.exit(1);
}

requireMacOS();
fs.mkdirSync(path.dirname(outPath), { recursive: true });

const context = await launchExtensionBrowser();

try {
  let page = context.pages()[0];
  if (!page) page = await context.waitForEvent('page');
  await Promise.all(context.pages().filter((p) => p !== page).map((p) => p.close()));

  const sw = await getServiceWorker(context);
  await sw.evaluate(async () => {
    await chrome.storage.local.set({ skipWaitGloballyEnabled: true });
  });

  await prepareBrowserWindow(page);

  const popupResult = await sw.evaluate(() =>
    chrome.action.openPopup().then(() => 'ok').catch((error) => String(error?.message || error))
  );
  if (popupResult !== 'ok') {
    throw new Error(`Could not open extension popup: ${popupResult}`);
  }

  await page.waitForTimeout(800);
  await captureBrowserWindow(page, outPath);
  console.log('Screenshot saved to', outPath);
} finally {
  await context.close();
}
