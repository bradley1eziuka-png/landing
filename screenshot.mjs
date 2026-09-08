// Usage:
//   node screenshot.mjs <url> [label] [device]
//   device: desktop (default, 1440x900) | tablet (768x1024) | mobile (390x844)
// Saves full-page PNG to ./temporary screenshots/screenshot-N[-label].png (auto-incremented).
import { chromium } from "playwright";
import { mkdirSync, readdirSync } from "fs";
import path from "path";

const url = process.argv[2];
const label = process.argv[3];
const device = process.argv[4] || "desktop";

if (!url) {
  console.error("Usage: node screenshot.mjs <url> [label] [device: desktop|tablet|mobile]");
  process.exit(1);
}

const viewports = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
};

const viewport = viewports[device];
if (!viewport) {
  console.error(`Unknown device "${device}". Use desktop, tablet, or mobile.`);
  process.exit(1);
}

const outDir = path.join(process.cwd(), "temporary screenshots");
mkdirSync(outDir, { recursive: true });

const existing = readdirSync(outDir).filter((f) => /^screenshot-\d+/.test(f));
const nextNum =
  existing.reduce((max, f) => {
    const m = f.match(/^screenshot-(\d+)/);
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 0) + 1;

const suffixParts = [device !== "desktop" ? device : null, label || null].filter(Boolean);
const suffix = suffixParts.length ? `-${suffixParts.join("-")}` : "";
const filename = `screenshot-${nextNum}${suffix}.png`;
const filePath = path.join(outDir, filename);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport });
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(300);

// Resize the viewport to the full document height *before* screenshotting.
// This makes every element (incl. below-the-fold reveal/lazy content)
// intersect the viewport in one paint, so IntersectionObserver-driven
// animations fire and lazy images load without a scroll-and-stitch capture
// (which would otherwise repaint `position: fixed` elements at every tile).
const fullHeight = await page.evaluate(() => document.documentElement.scrollHeight);
await page.setViewportSize({ width: viewport.width, height: fullHeight });
await page.waitForTimeout(500);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(200);

await page.screenshot({ path: filePath, fullPage: false });
await browser.close();

console.log(`Saved: ${path.relative(process.cwd(), filePath)}`);
