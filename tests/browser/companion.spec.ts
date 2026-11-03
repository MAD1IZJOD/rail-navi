import {test,expect,type Page} from "@playwright/test";
import {demoStation as station} from "../../src/lib/station/demo-station";
import {planJourney} from "../../src/lib/journey/planner";
import {toJourneyStop} from "../../src/lib/facilities/search";
import type {Facility,FloorId} from "../../src/lib/navigation/types";
async function planned(page:Page){
 await page.goto("/");await page.getByRole("link",{name:"Find My Platform",exact:true}).click();
 await page.getByRole("button",{name:/Platform 17 simulator demo/}).click();await page.getByRole("button",{name:"Find ticket",exact:true}).click();
 await expect(page.getByTestId("ticket-platform")).toHaveText("17");
 await page.getByLabel("Where are you starting?").selectOption("gate-2");
 await page.getByRole("button",{name:"Navigate to Platform 17",exact:true}).click();
 await expect(page.getByTestId("route-summary")).toContainText("Platform 17");
}
async function discover(page:Page,q:string){
 await page.getByRole("button",{name:"Facilities",exact:true}).click();await page.getByRole("textbox",{name:"Search facilities"}).fill(q);
 await expect(page.locator(".discovery-result").first()).toBeVisible();
}
async function add(page:Page,q:string):Promise<Facility>{
 await discover(page,q);const card=page.locator(".discovery-result").first();const name=await card.locator("strong").innerText();
 const f=station.facilities.find(f=>f.name===name)!;expect(f).toBeTruthy();await card.click();
 const details=page.getByRole("region",{name:"Selected facility"});await expect(details).toContainText("walking detour");
 await expect(page.getByTestId("detour-segment").first()).toBeAttached();
 await details.getByRole("button",{name:"Add stop · keep platform last",exact:true}).click();
 await expect(details).toHaveCount(0);await expect(page.getByTestId("active-platform")).toHaveText("17");
 return f;
}
async function journey(page:Page){await fold(page);await page.locator(".journey-status-strip").click();await expect(page.getByRole("heading",{name:"Useful stops. Platform last."})).toBeVisible();}
async function fold(page:Page){const toggle=page.locator(".mobile-panel-toggle");if(await toggle.isVisible()&&await toggle.getAttribute("aria-expanded")==="true")await toggle.click();}
test("ticket journey discovers real stops, optimizes, visits and reroutes to a changed platform",async({page},info)=>{
 test.setTimeout(90000);const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
 await planned(page);const water=await add(page,"water on my way"),pharmacy=await add(page,"pharmacy");
 await journey(page);await expect(page.locator(".itinerary-list li")).toHaveCount(3);
 await expect(page.locator(".final-destination")).toContainText("Platform 17");await expect(page.locator(".timing-panel")).toContainText("Estimates do not guarantee boarding");
 await page.getByRole("button",{name:"Optimize order",exact:true}).click();
 const order=await page.locator(".itinerary-list li:not(.final-destination) strong").allTextContents();
 const stops=order.map(name=>toJourneyStop([water,pharmacy].find(f=>f.name===name)!,19*3600+55*60));
 const expected=planJourney(station,"gate-2","p17-destination",stops,{preference:"fastest"});
 await fold(page);
 for(const floor of [-2,-1,0,1,2] as FloorId[]){
  await page.getByRole("button",{name:`Show Level ${floor>0?"+":""}${floor}`,exact:true}).click();
  const actual=await page.getByTestId("route-segment").evaluateAll(els=>els.map(e=>e.getAttribute("data-edge-id")).sort());
  expect(actual).toEqual(expected.edges.filter((_,i)=>expected.nodes[i]!.floor===floor&&expected.nodes[i+1]!.floor===floor).map(e=>e.id).sort());
 }
 await page.getByRole("button",{name:"Show Level 0",exact:true}).click();await fold(page);
 await page.getByRole("button",{name:"Start simulated navigation",exact:true}).click();
 await page.getByText("Demo controls",{exact:true}).click();await page.getByLabel("Simulation speed",{exact:true}).selectOption("120");await page.getByText("Demo controls",{exact:true}).click();
 await expect(page.getByTestId("simulation-status")).toHaveText("at-stop",{timeout:20000});
 await expect(page.locator(".simulation-feedback")).toContainText("Continue when you are ready");
 const marker=page.getByTestId("passenger-marker"),point={x:await marker.getAttribute("data-x"),y:await marker.getAttribute("data-y")};
 await page.getByText("Demo controls",{exact:true}).click();await page.getByLabel("Close Bridge A",{exact:true}).check();await page.getByText("Demo controls",{exact:true}).click();
 await page.getByText("Simulate platform change",{exact:true}).click();await page.getByLabel("Demo assignment").selectOption("platform-11");await page.getByText("Simulate platform change",{exact:true}).click();
 await expect(page.getByTestId("active-platform")).toHaveText("11");await expect(marker).toHaveAttribute("data-x",point.x!);await expect(marker).toHaveAttribute("data-y",point.y!);
 await expect(page.locator(".directions-list")).toContainText("Platform 11");await expect(page.locator(".directions-list li").last()).toContainText("You have reached Platform 11 boarding area");
 await page.getByRole("button",{name:"Continue after visit",exact:true}).click();await expect(page.getByTestId("simulation-status")).toHaveText("at-stop",{timeout:20000});
 await page.getByRole("button",{name:"Continue after visit",exact:true}).click();await expect(page.getByTestId("simulation-status")).toHaveText("arrived",{timeout:25000});
 await expect(page.locator(".simulation-feedback")).toContainText("Platform 11 boarding area");await expect(page.locator(".itinerary-list li")).toHaveCount(1);
 await page.screenshot({path:info.outputPath("companion-arrival.png"),animations:"disabled"});expect(errors).toEqual([]);
});
test("stop ordering, availability, timing warnings and assistance work without losing the platform",async({page})=>{
 await planned(page);const water=await add(page,"water on my way"),pharmacy=await add(page,"pharmacy");
 await journey(page);const order=await page.locator(".itinerary-list li:not(.final-destination) strong").allTextContents();
 await page.getByRole("button",{name:"Move "+order[1]+" earlier",exact:true}).click();await journey(page);
 expect(await page.locator(".itinerary-list li:not(.final-destination) strong").allTextContents()).toEqual([order[1],order[0]]);
 await page.getByLabel("Visit minutes for "+pharmacy.name).fill("30");await journey(page);
 await expect(page.locator(".timing-panel")).toContainText("Not recommended");await page.locator(".companion-demo summary").click();
 await page.getByLabel("Facility availability",{exact:true}).selectOption(pharmacy.id);
 await expect(page.locator(".route-error")).toContainText("unavailable");
 const toggle=page.locator(".mobile-panel-toggle");if(await toggle.isVisible()&&await toggle.getAttribute("aria-expanded")==="false")await toggle.click();
 await page.getByRole("button",{name:"Remove "+pharmacy.name,exact:true}).click();await expect(page.getByTestId("route-summary")).toContainText("Platform 17");
 await journey(page);await page.getByRole("button",{name:"Clear optional stops",exact:true}).click();await journey(page);await expect(page.locator(".itinerary-list li")).toHaveCount(1);
 await page.getByRole("tab",{name:/Facilities/}).click();await page.getByRole("button",{name:"Passenger assistance",exact:true}).click();
 await page.getByRole("button",{name:"Find nearest help point",exact:true}).click();await expect(page.locator(".discovery-result").first()).toBeVisible();
 await page.locator(".discovery-result").first().click();await expect(page.getByRole("region",{name:"Selected facility"})).toContainText("Show accessible route");
 await page.getByRole("button",{name:"Show accessible route · add assistance stop",exact:true}).click();
 await expect(page.locator(".directions-list")).not.toContainText("stairs");await expect(page.getByTestId("active-platform")).toHaveText("17");
 expect(water).toBeTruthy();
});
test("facility discovery, detail sheets and timing layouts fit all six viewport widths",async({page},info)=>{
 test.setTimeout(90000);await page.emulateMedia({reducedMotion:"reduce"});
 for(const width of [360,390,430,768,1280,1440]){
  await page.setViewportSize({width,height:900});await planned(page);await discover(page,"water on my way");
  expect(await page.evaluate(()=>document.body.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath(`search-${width}.png`),animations:"disabled"});
  await page.locator(".discovery-result").first().click();
  const detail=page.getByRole("region",{name:"Selected facility"});await expect(detail).toBeInViewport();
  await expect(detail.getByRole("button",{name:"Add stop · keep platform last",exact:true})).toBeInViewport();
  await page.screenshot({path:info.outputPath(`facility-${width}.png`),animations:"disabled"});
  await detail.getByRole("button",{name:"Add stop · keep platform last",exact:true}).click();await journey(page);
  await expect(page.locator(".final-destination")).toContainText("Platform 17");expect(await page.evaluate(()=>document.body.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath(`itinerary-${width}.png`),animations:"disabled"});
 }
});

test("adding and removing a stop during movement preserves position, pause and the final platform",async({page})=>{
 test.setTimeout(60000);await planned(page);
 await page.getByRole("button",{name:"Start simulated navigation",exact:true}).click();
 await discover(page,"water on my way");const card=page.locator(".discovery-result").first();const name=await card.locator("strong").innerText();await card.click();
 const marker=page.getByTestId("passenger-marker"),before={x:Number(await marker.getAttribute("data-x")),y:Number(await marker.getAttribute("data-y"))};
 await page.getByRole("button",{name:"Add stop · keep platform last",exact:true}).click();
 await expect(page.getByTestId("simulation-status")).toHaveText("running");
 const after={x:Number(await marker.getAttribute("data-x")),y:Number(await marker.getAttribute("data-y"))};expect(Math.hypot(after.x-before.x,after.y-before.y)).toBeLessThan(5);
 await page.getByRole("button",{name:"Pause",exact:true}).click();const point={x:await marker.getAttribute("data-x"),y:await marker.getAttribute("data-y")};
 await journey(page);await page.getByRole("button",{name:"Remove "+name,exact:true}).click();
 await expect(page.getByTestId("simulation-status")).toHaveText("paused");await expect(marker).toHaveAttribute("data-x",point.x!);await expect(marker).toHaveAttribute("data-y",point.y!);
 await expect(page.locator(".final-destination")).toContainText("Platform 17");await expect(page.locator(".itinerary-list li")).toHaveCount(1);
 await fold(page);await page.getByText("Demo controls",{exact:true}).click();await page.getByLabel("Simulation speed",{exact:true}).selectOption("120");await page.getByText("Demo controls",{exact:true}).click();
 await page.getByRole("button",{name:"Resume",exact:true}).click();await expect(page.getByTestId("simulation-status")).toHaveText("arrived",{timeout:20000});
 await page.getByRole("button",{name:"Stop navigation",exact:true}).click();await expect(page.getByTestId("route-summary")).toHaveCount(0);await expect(page.getByTestId("route-segment")).toHaveCount(0);
});

test("an individual lift closure finds another accessible route without changing the passenger position",async({page})=>{
 test.setTimeout(60000);await planned(page);const toggle=page.locator(".mobile-panel-toggle");if(await toggle.isVisible())await toggle.click();
 await page.getByRole("button",{name:"Switch to a step-free route",exact:true}).click();await fold(page);
 await page.getByRole("button",{name:"Start simulated navigation",exact:true}).click();await page.getByRole("button",{name:"Pause",exact:true}).click();
 const marker=page.getByTestId("passenger-marker"),point={x:await marker.getAttribute("data-x"),y:await marker.getAttribute("data-y")};
 await page.getByText("Demo controls",{exact:true}).click();const control=page.getByLabel("Crossing outage",{exact:true});const lift=await control.locator('option[value^="lift:"]').first().getAttribute("value");expect(lift).toBeTruthy();await control.selectOption(lift!);
 await expect(page.getByTestId("simulation-status")).toHaveText("paused");await expect(page.locator(".simulation-feedback")).toContainText("Lift at");await expect(marker).toHaveAttribute("data-x",point.x!);await expect(marker).toHaveAttribute("data-y",point.y!);
 await expect(page.locator(".directions-list")).toContainText("lift");await expect(page.locator(".directions-list")).not.toContainText("stairs");await expect(page.locator(".directions-list")).not.toContainText("escalator");await expect(page.getByTestId("active-platform")).toHaveText("17");
 await page.getByLabel("Simulation speed",{exact:true}).selectOption("120");await page.getByText("Demo controls",{exact:true}).click();await page.getByRole("button",{name:"Resume",exact:true}).click();await expect(page.getByTestId("simulation-status")).toHaveText("arrived",{timeout:20000});
});
