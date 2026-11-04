import {test,expect,type Page} from "@playwright/test";
test.beforeEach(async({page})=>{await page.addInitScript(()=>{localStorage.removeItem("railnavi-journey-v1");localStorage.setItem("railnavi-language-v1","en");});});
import {demoStation as station} from "../../src/lib/station/demo-station";
import {findRoute} from "../../src/lib/navigation/engine";
async function booking(page:Page){await page.goto("/");await page.getByRole("link",{name:"Find My Platform",exact:true}).click();await page.getByRole("button",{name:/Try a sample/}).click();await page.getByRole("button",{name:"Find ticket",exact:true}).click();await expect(page.getByTestId("ticket-platform")).toHaveText("10");}
test("ticket to accessible navigation follows a changed platform assignment",async({page},info)=>{
 const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
 await booking(page);await page.getByLabel("Where are you starting?").selectOption("gate-1");
 await page.getByRole("button",{name:"Navigate to Platform 10",exact:true}).click();
 await expect(page.getByTestId("active-platform")).toHaveText("10");
 await expect(page.locator(".next-direction")).toBeInViewport();
 const toggle=page.locator(".mobile-panel-toggle");if(await toggle.isVisible())await toggle.click();
 await page.getByRole("button",{name:"Switch to a step-free route"}).click();
 await expect(page.getByTestId("route-summary")).toContainText("Wheelchair");
 await page.getByText("Simulate platform change",{exact:true}).click();
 await page.getByLabel("Demo assignment").selectOption("platform-6");
 await expect(page.getByTestId("active-platform")).toHaveText("6");
 await expect(page.getByRole("status")).toContainText("moved to Platform 6");
 await expect(page.getByTestId("route-summary")).toContainText("Platform 6 boarding area");
 const expected=findRoute(station,"gate-1","p6-destination",{preference:"wheelchair"});
 for(const floor of [0,1,-1]){await page.getByRole("button",{name:`Show Level ${floor>0?"+":""}${floor}`,exact:true}).click();expect(await page.getByTestId("route-segment").evaluateAll(es=>es.map(e=>e.getAttribute("data-edge-id")).sort())).toEqual(expected.edges.filter((_,i)=>expected.nodes[i]?.floor===floor&&expected.nodes[i+1]?.floor===floor).map(e=>e.id).sort());}
 await page.screenshot({path:info.outputPath("changed-platform.png"),animations:"disabled"});
 await page.getByRole("button",{name:"Find My Platform",exact:true}).click();
 await page.getByRole("button",{name:/Try a sample/}).click();await page.getByRole("button",{name:"Find ticket",exact:true}).click();await expect(page.getByTestId("ticket-platform")).toHaveText("6");expect(errors).toEqual([]);
});
test("invalid references cancelled bookings train search and clean reset",async({page})=>{
 await page.goto("/ticket");await page.getByLabel("Synthetic booking reference").fill("1234567890");await page.getByRole("button",{name:"Find ticket",exact:true}).click();await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Do not enter a real PNR");
 await page.getByLabel("Synthetic booking reference").fill("RN-DEMO-1020");await page.getByRole("button",{name:"Find ticket",exact:true}).click();await expect(page.getByRole("dialog").getByRole("alert")).toContainText("unavailable");
 await page.getByRole("button",{name:"Find a train",exact:true}).click();await page.getByLabel("Train name or demo number").fill("moonrize");await page.locator(".train-results button").click();await expect(page.getByTestId("ticket-platform")).toHaveText("10");await page.getByRole("button",{name:"Navigate to Platform 10",exact:true}).click();await expect(page.getByTestId("route-summary")).toContainText("Platform 10");
 await page.getByRole("button",{name:"Find My Platform",exact:true}).click();await expect(page.getByLabel("Synthetic booking reference")).toHaveValue("");
});
test("six viewport layouts remain readable with reduced motion",async({page},info)=>{
 await page.emulateMedia({reducedMotion:"reduce"});
 for(const width of [360,390,430,768,1280,1440]){
 await page.setViewportSize({width,height:900});await booking(page);
 expect(await page.evaluate(()=>document.body.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole("button",{name:"Navigate to Platform 10",exact:true}).click();await expect(page.getByTestId("start-marker")).toBeVisible();
 await page.screenshot({path:info.outputPath(`station-${width}.png`),animations:"disabled"});
 }
});
