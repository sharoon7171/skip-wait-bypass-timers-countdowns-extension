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
const POPUP_VIEWPORT = { width: 360, height: 520 };
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
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#f0f4f8"/><stop offset="100%" style="stop-color:#e2e8f0"/></linearGradient>
        <linearGradient id="blob1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#93c5fd;stop-opacity:0.4"/><stop offset="100%" style="stop-color:#c4b5fd;stop-opacity:0.2"/></linearGradient>
        <linearGradient id="blob2" x1="100%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#fda4af;stop-opacity:0.3"/><stop offset="100%" style="stop-color:#fed7aa;stop-opacity:0.15"/></linearGradient>
        <linearGradient id="blob3" x1="50%" y1="100%" x2="50%" y2="0%"><stop offset="0%" style="stop-color:#a5f3fc;stop-opacity:0.25"/><stop offset="100%" style="stop-color:#67e8f9;stop-opacity:0.08"/></linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bgGrad)"/>
      <ellipse cx="${w * 0.85}" cy="${h * 0.15}" rx="220" ry="180" fill="url(#blob1)"/>
      <ellipse cx="${w * 0.12}" cy="${h * 0.78}" rx="200" ry="220" fill="url(#blob2)"/>
      <path d="M0 ${h * 0.5} Q${w * 0.3} ${h * 0.2} ${w * 0.5} ${h * 0.5} T${w} ${h * 0.55}" fill="none" stroke="url(#blob3)" stroke-width="120" stroke-linecap="round" opacity="0.6"/>
      <circle cx="${w * 0.08}" cy="${h * 0.2}" r="80" fill="#93c5fd" opacity="0.12"/>
      <circle cx="${w * 0.92}" cy="${h * 0.75}" r="100" fill="#c4b5fd" opacity="0.1"/>
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
