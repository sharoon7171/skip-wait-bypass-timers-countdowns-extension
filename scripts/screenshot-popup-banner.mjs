#!/usr/bin/env node
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
const OUT_PATH = join(ROOT, 'doc', 'popup-banner-1280x800.png');
const PORT = 18766;
const POPUP_VIEWPORT = { width: 800, height: 600 };
const BANNER_VIEWPORT = { width: 1280, height: 800 };

function ensureDist() {
  const popupPath = join(DIST, 'popup.html');
  if (!existsSync(DIST) || !existsSync(popupPath)) {
    console.error('Run "npm run build" first so dist/ contains the built popup.');
    process.exit(1);
  }
}

function startStaticServer() {
  return new Promise((done) => {
    const server = createServer((req, res) => {
      const url = req.url === '/' ? '/popup.html' : req.url;
      const subPath = (url || '').split('?')[0].slice(1) || '.';
      const filePath = resolve(join(DIST, subPath));
      if (!filePath.startsWith(resolve(DIST))) {
        res.writeHead(403).end();
        return;
      }
      let data;
      try {
        data = readFileSync(filePath);
      } catch {
        res.writeHead(404).end();
        return;
      }
      const ext = filePath.slice(filePath.lastIndexOf('.'));
      const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
      res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
      res.end(data);
    });
    server.listen(PORT, '127.0.0.1', () => done(server));
  });
}

async function run() {
  ensureDist();
  const server = await startStaticServer();
  const base = `http://127.0.0.1:${PORT}`;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: POPUP_VIEWPORT });
  const page = await context.newPage();
  await page.goto(`${base}/popup.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#root', { state: 'attached' });
  await page.waitForTimeout(800);
  const popupBuffer = await page.screenshot({ type: 'png' });
  await context.close();

  const dataUrl = `data:image/png;base64,${popupBuffer.toString('base64')}`;
  const bannerPage = await browser.newPage();
  await bannerPage.setViewportSize(BANNER_VIEWPORT);
  const margin = 40;
  const fitHeight = BANNER_VIEWPORT.height - margin * 2;
  const w = BANNER_VIEWPORT.width;
  const h = BANNER_VIEWPORT.height;
  const bgSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" style="position:absolute;inset:0;width:100%;height:100%;" aria-hidden="true">
      <defs>
        <linearGradient id="bgBase" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#f4f6f3"/>
          <stop offset="38%" stop-color="#eef2f6"/>
          <stop offset="72%" stop-color="#f2eff5"/>
          <stop offset="100%" stop-color="#f7f5f0"/>
        </linearGradient>
        <radialGradient id="washAccent" cx="88%" cy="12%" r="48%">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="#38bdf8" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="washMist" cx="8%" cy="88%" r="42%">
          <stop offset="0%" stop-color="#94a3b8" stop-opacity="0.14"/>
          <stop offset="100%" stop-color="#94a3b8" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="bgBloom" cx="50%" cy="48%" r="64%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.58"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>
        <pattern id="patWaves" width="140" height="22" patternUnits="userSpaceOnUse">
          <path
            d="M0 11 Q35 2.5 70 11 T140 11"
            fill="none"
            stroke="#64748b"
            stroke-width="0.5"
            opacity="0.065"
          />
          <path
            d="M0 17 Q35 8 70 17 T140 17"
            fill="none"
            stroke="#64748b"
            stroke-width="0.4"
            opacity="0.045"
          />
        </pattern>
        <pattern id="patMesh" width="64" height="64" patternUnits="userSpaceOnUse" patternTransform="rotate(35 32 32)">
          <path d="M0 32h64M32 0v64" fill="none" stroke="#78716c" stroke-width="0.4" opacity="0.04"/>
        </pattern>
        <filter id="grain" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.62" numOctaves="1" seed="67" stitchTiles="stitch" result="g"/>
          <feColorMatrix in="g" type="saturate" values="0"/>
        </filter>
      </defs>
      <rect width="100%" height="100%" fill="url(#bgBase)"/>
      <rect width="100%" height="100%" fill="url(#washAccent)"/>
      <rect width="100%" height="100%" fill="url(#washMist)"/>
      <rect width="100%" height="100%" fill="url(#patWaves)"/>
      <rect width="100%" height="100%" fill="url(#patMesh)"/>
      <rect width="100%" height="100%" fill="url(#bgBloom)"/>
      <rect width="100%" height="100%" fill="#ffffff" filter="url(#grain)" opacity="0.1" style="mix-blend-mode:soft-light"/>
    </svg>`;
  await bannerPage.setContent(
    `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;">${bgSvg}<img src="${dataUrl}" alt="Skip Wait popup" style="position:relative;z-index:1;height:${fitHeight}px;width:auto;box-shadow:0 20px 60px rgba(0,0,0,0.15);border-radius:12px;display:block;" /></body></html>`,
    { waitUntil: 'load' }
  );
  await bannerPage.waitForTimeout(300);
  const outDir = dirname(OUT_PATH);
  if (!existsSync(outDir)) {
    const { mkdirSync } = await import('fs');
    mkdirSync(outDir, { recursive: true });
  }
  await bannerPage.screenshot({ path: OUT_PATH, type: 'png' });
  await browser.close();
  server.close();
  console.log('Saved:', OUT_PATH);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
