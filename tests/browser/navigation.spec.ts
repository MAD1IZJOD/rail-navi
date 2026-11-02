import { test, expect, type Page } from "@playwright/test";
import { findRoute } from "../../src/lib/navigation/engine";
import { demoStation as station, bridgeAEdgeIds } from "../../src/lib/station/demo-station";
import type { FloorId, GeneratedRoute } from "../../src/lib/navigation/types";

async function openPanel(page: Page) {
  const toggle = page.locator(".mobile-panel-toggle");
  if (await toggle.isVisible() && await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
}
async function quickRoute(page: Page) {
  await page.goto("/demo");
  await page.getByRole("button", { name: "Try Gate 1 to Platform 10", exact: true }).click();
  await expect(page.getByTestId("route-summary")).toContainText("YOUR ROUTE IS READY");
}
async function verifySegments(page: Page, route: GeneratedRoute) {
  for (const floor of [0, 1, -1] as FloorId[]) {
    await page.getByRole("button", { name: `Show Level ${floor > 0 ? "+" : ""}${floor}`, exact: true }).click();
    const expected = route.edges.filter((_, i) => route.nodes[i]?.floor === floor && route.nodes[i + 1]?.floor === floor).map(edge => edge.id).sort();
    const actual = await page.getByTestId("route-segment").evaluateAll(elements => elements.map(element => element.getAttribute("data-edge-id")).sort());
    expect(actual).toEqual(expected);
  }
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.exposeFunction("browserErrors", () => errors);
});
test.afterEach(async ({ page }) => {
  const errors = await page.evaluate(() => (window as unknown as { browserErrors: () => Promise<string[]> }).browserErrors());
  expect(errors, "Browser console and runtime errors").toEqual([]);
});

test("homepage introduces the fictional station and opens the working demo", async ({ page }, info) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Find your way. Catch your train." })).toBeVisible();
  await expect(page.getByText("FICTIONAL STATION", { exact: true })).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", await page.evaluate(() => window.innerWidth));
  await page.screenshot({ path: info.outputPath("homepage.png"), fullPage: true });
  await page.getByRole("link", { name: "Explore Demo Station", exact: true }).click();
  await expect(page.getByRole("heading", { name: "RailNavi Demo Central" })).toBeVisible();
  await expect(page.getByRole("group", { name: /Interactive station map/ })).toBeVisible();
});

test("Gate 1 to Platform 10 draws exactly the computed edges on each floor", async ({ page }, info) => {
  await quickRoute(page);
  const expected = findRoute(station, "gate-1", "p10-destination");
  await expect(page.getByTestId("route-summary")).toContainText(`${Math.round(expected.distanceMeters)}`);
  await expect(page.locator(".directions-list")).toContainText("escalator up to Level +1");
  await expect(page.locator(".directions-list")).toContainText("stairs down to Level 0");
  if (await page.locator(".mobile-panel-toggle").isVisible()) await openPanel(page);
  else await page.locator(".map-route-chip").getByRole("button", { name: "Directions" }).click();
  await expect(page.getByRole("heading", { name: "Your way, step by step" })).toBeVisible();
  await page.locator(".direction-step").filter({ hasText: "escalator up to Level +1" }).click();
  await expect(page.getByRole("button", { name: "Show Level +1", exact: true })).toHaveAttribute("aria-pressed", "true");
  await verifySegments(page, expected);
  await page.getByRole("button", { name: "Show Level +1", exact: true }).click();
  await expect(page.getByTestId("floor-transition")).toHaveCount(2);
  await page.screenshot({ path: info.outputPath("route.png"), fullPage: true });
});

test("step-free switch recomputes a lift route with accessible edges", async ({ page }) => {
  await quickRoute(page);
  await openPanel(page);
  await page.getByRole("button", { name: "Switch to a step-free route" }).click();
  const expected = findRoute(station, "gate-1", "p10-destination", { preference: "wheelchair" });
  await expect(page.getByTestId("route-summary")).toContainText("Wheelchair");
  await expect(page.locator(".directions-list")).toContainText("Take the lift");
  await expect(page.locator(".directions-list")).not.toContainText("stairs");
  await expect(page.locator(".directions-list")).not.toContainText("escalator");
  await verifySegments(page, expected);
});

test("changing entrance destination and preference computes another route", async ({ page }) => {
  await quickRoute(page);
  await openPanel(page);
  await page.getByLabel("YOUR STARTING POINT").selectOption("gate-4");
  await expect(page.getByTestId("route-segment")).toHaveCount(0);
  await page.getByLabel("YOUR DESTINATION").selectOption("p2-destination");
  await page.getByRole("radio", { name: /Shortest/ }).check();
  await page.getByRole("button", { name: "Find my route", exact: true }).click();
  const expected = findRoute(station, "gate-4", "p2-destination", { preference: "shortest" });
  await expect(page.getByTestId("route-summary")).toContainText("Gate 4");
  await expect(page.getByTestId("route-summary")).toContainText("Platform 2 boarding area");
  await expect(page.getByTestId("route-summary")).toContainText(`${Math.round(expected.distanceMeters)}`);
  await verifySegments(page, expected);
});

test("passage closure selects an actual alternative crossing", async ({ page }) => {
  await quickRoute(page);
  await openPanel(page);
  await page.getByText("Passage availability", { exact: true }).click();
  await page.getByRole("checkbox", { name: "Simulate Bridge A closure" }).check();
  await page.getByRole("button", { name: "Find my route", exact: true }).click();
  await expect(page.locator(".closure-banner")).toBeVisible();
  const expected = findRoute(station, "gate-1", "p10-destination", { preference: "fastest", blockedEdgeIds: bridgeAEdgeIds });
  await expect(page.locator(".directions-list")).toContainText("Lower passenger passage");
  await verifySegments(page, expected);
});

test("facility search inspection and route here are functional", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: "Facilities", exact: true }).click();
  await page.getByRole("textbox", { name: "Search facilities" }).fill("Pharmacy");
  await expect(page.locator(".facility-card")).toHaveCount(1);
  await page.locator(".facility-card").click();
  const detail = page.getByRole("region", { name: "Selected facility" });
  await expect(detail).toContainText("Station Pharmacy");
  await detail.getByRole("button", { name: "Route here" }).click();
  await expect(page.getByTestId("route-summary")).toContainText("Station Pharmacy");
  const target = station.facilities.find(facility => facility.category === "pharmacy")!;
  await verifySegments(page, findRoute(station, "gate-1", target.nodeId));
});

test("map supports zoom pan keyboard reset and a bounded responsive viewport", async ({ page }) => {
  await page.goto("/demo");
  const map = page.getByRole("group", { name: /Interactive station map/ });
  const initial = await map.getAttribute("viewBox");
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(map).not.toHaveAttribute("viewBox", initial!);
  const zoomed = await map.getAttribute("viewBox");
  const box = (await map.boundingBox())!;
  await page.mouse.move(box.x + box.width * .45, box.y + box.height * .5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .35, box.y + box.height * .55, { steps: 8 });
  await page.mouse.up();
  await expect(map).not.toHaveAttribute("viewBox", zoomed!);
  await page.getByRole("button", { name: "Reset map view", exact: true }).click();
  await expect(map).toHaveAttribute("viewBox", initial!);
  await map.focus();
  await page.keyboard.press("+");
  await expect(map).not.toHaveAttribute("viewBox", initial!);
  await page.getByRole("button", { name: "Reset map view", exact: true }).click();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", await page.evaluate(() => window.innerWidth));
  const mapBounds = (await map.boundingBox())!;
  expect(mapBounds.height).toBeGreaterThan(250);
  await openPanel(page);
  await expect(page.getByLabel("YOUR STARTING POINT")).toBeVisible();
});

test("touch pointers pinch and pan the map", async ({ page, context }) => {
  await page.goto("/demo");
  const map = page.getByRole("group", { name: /Interactive station map/ });
  const before = await map.getAttribute("viewBox");
  const rect = (await map.boundingBox())!;
  const x = rect.x + rect.width * .5;
  const y = rect.y + rect.height * .5;
  const cdp = await context.newCDPSession(page);
  const points = (spread: number) => [{ x: x - spread, y, id: 1 }, { x: x + spread, y, id: 2 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: points(25) });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: points(70) });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(map).not.toHaveAttribute("viewBox", before!);
  const pinched = await map.getAttribute("viewBox");
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + 40, y: y + 25, id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(map).not.toHaveAttribute("viewBox", pinched!);
  await cdp.detach();
});
