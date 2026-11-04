import {test,expect,type Page} from "@playwright/test";
test.beforeEach(async({page})=>{await page.addInitScript(()=>{localStorage.removeItem("railnavi-journey-v1");localStorage.setItem("railnavi-language-v1","en");});});
async function planned(page:Page){
 await page.goto("/ticket");await page.getByRole("button",{name:/Platform 17 simulator demo/}).click();
 await page.getByRole("button",{name:"Find ticket",exact:true}).click();await expect(page.getByTestId("ticket-platform")).toHaveText("17");
 await page.getByLabel("Where are you starting?").selectOption("gate-2");await page.getByRole("button",{name:"Navigate to Platform 17",exact:true}).click();
}
async function beginPaused(page:Page){
 await page.getByRole("button",{name:"Start simulated navigation",exact:true}).click();
 await page.getByRole("button",{name:"Pause",exact:true}).click();
 await expect(page.getByTestId("simulation-status")).toHaveText("paused");
}
test("scripted Platform 17 journey crosses levels deviates reroutes and arrives at Platform 11",async({page},info)=>{
 test.setTimeout(90000);const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
 await planned(page);await beginPaused(page);
 for(let i=0;i<30&&await page.getByTestId("passenger-marker").getAttribute("data-floor")!=="1";i++)await page.getByRole("button",{name:"Next decision point",exact:true}).click();
 await expect(page.getByTestId("passenger-marker")).toHaveAttribute("data-floor","1");
 await page.getByText("Demo controls",{exact:true}).click();
 const alternative=page.getByLabel("Alternative connection");
 const target=await alternative.locator("option").nth(1).getAttribute("value");expect(target).toBeTruthy();
 await alternative.selectOption(target!);
 await page.getByRole("button",{name:"Take selected path",exact:true}).click();
 await page.getByRole("button",{name:"Pause",exact:true}).click();await page.getByRole("button",{name:"Next decision point",exact:true}).click();
 await expect(page.locator(".simulation-feedback")).toContainText("Wrong turn detected");
 await page.getByLabel("Crossing outage",{exact:true}).selectOption("Foot Overbridge B");
 await expect(page.locator(".simulation-feedback")).toContainText("Foot Overbridge B closed");
 const marker=page.getByTestId("passenger-marker"),before={x:await marker.getAttribute("data-x"),y:await marker.getAttribute("data-y")};
 await page.getByText("Demo controls",{exact:true}).click();
 await page.getByText("Simulate platform change",{exact:true}).click();await page.getByLabel("Demo assignment").selectOption("platform-11");
 await expect(page.getByTestId("active-platform")).toHaveText("11");
 await expect(marker).toHaveAttribute("data-x",before.x!);await expect(marker).toHaveAttribute("data-y",before.y!);
 await page.getByRole("button",{name:"Fit to route",exact:true}).click();
 await page.getByText("Demo controls",{exact:true}).click();await page.getByLabel("Simulation speed",{exact:true}).selectOption("120");
 await page.getByText("Demo controls",{exact:true}).click();await page.getByRole("button",{name:"Resume",exact:true}).click();
 await expect(page.getByTestId("simulation-status")).toHaveText("arrived",{timeout:25000});
 await expect(page.locator(".simulation-feedback")).toContainText("Platform 11 boarding area");await expect(marker).toHaveAttribute("data-floor","0");
 await page.screenshot({path:info.outputPath("arrival.png"),animations:"disabled"});expect(errors).toEqual([]);
});
test("wheelchair lift outage blocks safely and recovers without stairs",async({page})=>{
 test.setTimeout(60000);await planned(page);
 const toggle=page.locator(".mobile-panel-toggle");if(await toggle.isVisible())await toggle.click();
 await page.getByRole("button",{name:"Switch to a step-free route"}).click();await beginPaused(page);
 await page.getByText("Demo controls",{exact:true}).click();await page.getByLabel("Simulate all lifts unavailable",{exact:true}).check();
 await expect(page.getByTestId("simulation-status")).toHaveText("blocked");
 await expect(page.getByTestId("route-segment")).toHaveCount(0);await expect(page.locator(".simulation-feedback")).toContainText("No safe route");
 await page.getByLabel("Simulate all lifts unavailable",{exact:true}).uncheck();await expect(page.getByTestId("simulation-status")).toHaveText("paused");
 await expect(page.locator(".directions-list")).not.toContainText("stairs");
 await page.getByLabel("Simulation speed",{exact:true}).selectOption("120");await page.getByText("Demo controls",{exact:true}).click();
 await page.getByRole("button",{name:"Resume",exact:true}).click();await expect(page.getByTestId("simulation-status")).toHaveText("arrived",{timeout:25000});
 await page.getByText("Demo controls",{exact:true}).click();await page.getByRole("button",{name:"Restart journey",exact:true}).click();await expect(page.getByTestId("simulation-status")).toHaveText("running");
 await page.getByRole("button",{name:"Stop navigation",exact:true}).click();await expect(page.getByTestId("passenger-marker")).toHaveCount(0);
});
test("map layers follow suspension recentering and all five levels work across six widths",async({page},info)=>{
 test.setTimeout(90000);await page.emulateMedia({reducedMotion:"reduce"});
 for(const width of [360,390,430,768,1280,1440]){
  await page.setViewportSize({width,height:900});await planned(page);await beginPaused(page);
  for(const floor of [-2,-1,0,1,2]){await page.getByRole("button",{name:`Show Level ${floor>0?"+":""}${floor}`,exact:true}).click();await expect(page.getByRole("group",{name:/Interactive station map/})).toHaveAttribute("aria-label",new RegExp("Level "+floor));}
  await page.getByRole("button",{name:"Center on passenger",exact:true}).click();await expect(page.getByTestId("passenger-marker")).toBeVisible();
  await page.getByRole("button",{name:"Zoom in",exact:true}).click();await expect(page.getByRole("button",{name:"Center on passenger",exact:true})).toHaveAttribute("aria-pressed","false");
  await page.getByRole("button",{name:"Center on passenger",exact:true}).click();await expect(page.getByRole("button",{name:"Center on passenger",exact:true})).toHaveAttribute("aria-pressed","true");
  await page.getByText("Layers",{exact:true}).click();await page.getByLabel("Tracks (restricted)",{exact:true}).uncheck();
  await page.getByText("Layers",{exact:true}).click();
  expect(await page.evaluate(()=>document.body.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.locator(".next-direction")).toBeInViewport();await page.screenshot({path:info.outputPath(`navigation-${width}.png`),animations:"disabled"});
 }
});
