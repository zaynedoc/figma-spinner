import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

const executablePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const baseUrl = process.env.QA_URL ?? "http://127.0.0.1:5173/";
const screenshotDir = path.join(os.tmpdir(), "figma-spinner-codex");
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();
const browserErrors = [];
page.on("pageerror", (error) => browserErrors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") browserErrors.push(message.text());
});

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  assert.equal(await page.locator("h1, header, footer").count(), 0);
  assert.equal(await page.locator(".stage-meta, .winner-card").count(), 0);
  assert.equal(await page.locator(".inventory-panel").count(), 0);
  await page.locator(".app-grid.inventory-hidden").waitFor();
  assert.equal(await page.locator(".corner-art").count(), 4);
  assert.equal(await page.locator(".corner-art--top-left").getAttribute("src"), "/topleft.png");
  const layerOrder = await page.evaluate(() => ({
    art: Number.parseInt(getComputedStyle(document.querySelector(".corner-art--bottom-left")).zIndex, 10),
    settings: Number.parseInt(getComputedStyle(document.querySelector(".settings-fab")).zIndex, 10),
  }));
  assert.ok(layerOrder.settings > layerOrder.art, `Settings button must overlay corner art: ${JSON.stringify(layerOrder)}`);
  const wheelBounds = await page.locator(".wheel").boundingBox();
  assert.ok(wheelBounds && wheelBounds.width >= 600, `Expected zoomed wheel, got ${wheelBounds?.width}`);
  await page.screenshot({ path: path.join(screenshotDir, "spinner-playwright-desktop.png") });

  await page.getByRole("button", { name: "Open settings" }).click();
  await page.locator("#spinner-settings").waitFor();
  await page.locator("#spinner-settings").evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
  });
  await page.screenshot({ path: path.join(screenshotDir, "spinner-settings-open.png") });
  const inventoryToggle = page.getByRole("checkbox", { name: "Show inventory panel" });
  assert.equal(await inventoryToggle.isChecked(), false);
  await inventoryToggle.check();
  await page.locator(".inventory-panel").waitFor();
  assert.match(await page.locator(".inventory-summary strong").innerText(), /88/);
  await page.locator("#duration").evaluate((element) => {
    element.value = "2";
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.getByRole("button", { name: /^Spin/ }).click();
  await page.locator(".spin-button.is-spinning").waitFor();
  const spinningButtonLayout = await page.locator(".spin-button.is-spinning").evaluate((button) => {
    const buttonStyle = getComputedStyle(button);
    const labelStyle = getComputedStyle(button.querySelector("span"));
    return {
      display: buttonStyle.display,
      alignItems: buttonStyle.alignItems,
      justifyContent: buttonStyle.justifyContent,
      fontSize: Number.parseFloat(labelStyle.fontSize),
    };
  });
  assert.deepEqual(spinningButtonLayout, { display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 });
  await page.locator(".winner-card.visible strong").waitFor({ timeout: 5000 });
  const winnerText = await page.locator(".winner-card.visible strong").innerText();
  assert.ok(winnerText.length > 0);
  assert.match((await page.locator(".wheel").getAttribute("style")) ?? "", /rotate\(/);

  await page.getByRole("button", { name: /By unit/ }).click();
  await page.locator(".wheel.unit-mode").waitFor();

  await page.locator(".qty-control input").first().fill("12");
  await page.locator(".inventory-summary strong").getByText(/76/).waitFor();
  await page.reload({ waitUntil: "networkidle" });
  assert.match(await page.locator(".inventory-summary strong").innerText(), /76/);
  assert.equal(await page.locator(".qty-control input").first().inputValue(), "12");

  await page.getByRole("button", { name: "Open settings" }).click();
  const downloadReady = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export JSON/ }).click();
  const download = await downloadReady;
  assert.equal(download.suggestedFilename(), "figma-merch-spinner.json");

  await page.getByRole("checkbox", { name: "Show inventory panel" }).uncheck();
  await page.locator(".app-grid.inventory-hidden").waitFor();

  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto(baseUrl, { waitUntil: "networkidle" });
  await mobile.screenshot({ path: path.join(screenshotDir, "spinner-playwright-mobile.png"), fullPage: true });
  const dimensions = await mobile.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  assert.equal(dimensions.content, dimensions.viewport, `Mobile overflow: ${JSON.stringify(dimensions)}`);

  for (const width of [320, 375, 414, 768]) {
    await mobile.setViewportSize({ width, height: 900 });
    const responsiveDimensions = await mobile.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    assert.equal(
      responsiveDimensions.content,
      responsiveDimensions.viewport,
      `Overflow at ${width}px: ${JSON.stringify(responsiveDimensions)}`,
    );
  }

  assert.deepEqual(browserErrors, []);
  console.log(JSON.stringify({
    status: "passed",
    desktop: path.join(screenshotDir, "spinner-playwright-desktop.png"),
    mobile: path.join(screenshotDir, "spinner-playwright-mobile.png"),
    settings: path.join(screenshotDir, "spinner-settings-open.png"),
    winner: winnerText,
    mobileDimensions: dimensions,
  }, null, 2));
} finally {
  await browser.close();
}
