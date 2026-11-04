import {test,expect,chromium,type Page} from "@playwright/test";
import {QRCodeWriter,BarcodeFormat} from "@zxing/library";
import {writeFile} from "node:fs/promises";
import {checkpointUrl,checkpoints} from "../../src/lib/positioning/checkpoints";
const gate=checkpoints.find(c=>c.nodeId==="gate-2")!;
async function route(page:Page){await page.goto("/demo");await page.getByRole("button",{name:"Try Gate 1 to Platform 10",exact:true}).click();await expect(page.getByTestId("route-summary")).toBeAttached();}
async function fold(page:Page){const b=page.locator(".mobile-panel-toggle");if(await b.isVisible()&&await b.getAttribute("aria-expanded")==="true")await b.click();}
async function scanner(page:Page,code:string){await page.getByRole("button",{name:"Scan checkpoint",exact:true}).click();await page.getByLabel("Checkpoint code or QR link").fill(code);await page.getByRole("button",{name:"Check code",exact:true}).click();await page.getByRole("button",{name:"Use this location",exact:true}).click();}
async function save(page:Page){await page.getByRole("button",{name:"Station & app",exact:true}).click();const button=page.getByRole("button",{name:"Save Station Offline",exact:true});await expect(button).toBeEnabled();await button.click();await expect(page.getByTestId("offline-version")).toBeVisible({timeout:30000});await page.getByRole("button",{name:"Close",exact:true}).click();}
test("decodes a real printed QR image and corrects the graph route",async({page,context},info)=>{
 const print=await context.newPage();await print.goto("/checkpoints");await expect(print.getByRole("button",{name:"Print checkpoints",exact:true})).toBeEnabled();
 const image=await print.locator('[data-checkpoint-id="RN-GATE-2"] svg').screenshot();await print.close();
 await route(page);await fold(page);await page.getByRole("button",{name:"Start simulated navigation",exact:true}).click();
 await page.getByRole("button",{name:"Scan checkpoint",exact:true}).click();await page.getByLabel("Decode QR image",{exact:true}).setInputFiles({name:"gate.png",mimeType:"image/png",buffer:image});
 await expect(page.getByRole("heading",{name:"Confirm location",exact:true})).toBeVisible();await page.getByRole("button",{name:"Use this location",exact:true}).click();
 await expect(page.locator(".confirmed-location")).toContainText("QR checkpoint");await expect(page.locator(".confirmed-location")).toContainText("Gate 2");
 await expect(page.getByTestId("route-summary")).toContainText("Platform 10");await expect(page.getByTestId("simulation-status")).toHaveCount(0);
 await page.screenshot({path:info.outputPath("qr-confirmed.png")});
});
test("real local camera decoder reads video frames and stops its media tracks",async({},info)=>{
 test.setTimeout(45000);const value=checkpointUrl(gate,"http://127.0.0.1:3100"),matrix=new QRCodeWriter().encode(value,BarcodeFormat.QR_CODE,320,320,new Map());
 const frame=Buffer.alloc(640*480*1.5,128);frame.fill(255,0,640*480);
 for(let y=0;y<320;y++)for(let x=0;x<320;x++)frame[(y+80)*640+x+160]=matrix.get(x,y)?0:255;
 const path=info.outputPath("checkpoint.y4m");await writeFile(path,Buffer.concat([Buffer.from("YUV4MPEG2 W640 H480 F5:1 Ip A1:1 C420jpeg\n"),...Array.from({length:30},()=>Buffer.concat([Buffer.from("FRAME\n"),frame]))]));
 const browser=await chromium.launch({args:["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream","--use-file-for-fake-video-capture="+path]});
 try{const context=await browser.newContext({permissions:["camera"]}),page=await context.newPage();
  await page.addInitScript(()=>{const real=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async options=>{const stream=await real(options);(window as Window&{cameraTracks?:MediaStreamTrack[]}).cameraTracks=stream.getTracks();return stream;};});
  await page.goto("http://127.0.0.1:3100/demo");await page.getByRole("button",{name:"Scan checkpoint",exact:true}).click();
  await page.getByRole("button",{name:"Open camera",exact:true}).click();await expect(page.getByRole("heading",{name:"Confirm location",exact:true})).toBeVisible({timeout:20000});
  expect(await page.evaluate(()=>(window as Window&{cameraTracks?:MediaStreamTrack[]}).cameraTracks?.every(t=>t.readyState==="ended"))).toBe(true);
  await page.getByRole("button",{name:"Use this location",exact:true}).click();await expect(page.locator(".confirmed-location")).toContainText("Gate 2");
 }finally{await browser.close();}
});
test("requests no camera on opening the sheet and handles permission denial",async({page})=>{
 await page.addInitScript(()=>{(window as Window&{cameraCalls?:number}).cameraCalls=0;navigator.mediaDevices.getUserMedia=async()=>{(window as Window&{cameraCalls:number}).cameraCalls++;throw new DOMException("Denied","NotAllowedError");};});
 await page.goto("/demo");await page.getByRole("button",{name:"Scan checkpoint",exact:true}).click();expect(await page.evaluate(()=>(window as Window&{cameraCalls:number}).cameraCalls)).toBe(0);
 await page.getByRole("button",{name:"Open camera",exact:true}).click();await expect(page.getByRole("alert")).toContainText("permission denied");await page.getByLabel("Checkpoint code or QR link").fill(gate.id);await page.getByRole("button",{name:"Check code",exact:true}).click();await expect(page.getByRole("button",{name:"Use this location",exact:true})).toBeVisible();
});
test("invalid codes and external deep links cannot move the passenger",async({page})=>{
 await page.goto("/demo?v=1&station=railnavi-demo-central&checkpoint=RN-NOT-REAL");await expect(page.locator(".platform-notice")).toContainText("Checkpoint not accepted");
 await page.getByRole("button",{name:"Scan checkpoint",exact:true}).click();await page.getByLabel("Checkpoint code or QR link").fill("https://evil.example/demo");await page.getByRole("button",{name:"Check code",exact:true}).click();await expect(page.getByRole("alert")).toContainText("external");
 await page.getByRole("button",{name:"Close scanner",exact:true}).click();await expect(page.locator(".confirmed-location")).toContainText("Gate 1");
});
test("recovers the confirmed checkpoint, preference and stops without resuming movement",async({page})=>{
 await route(page);await scanner(page,gate.id);await page.getByRole("radio",{name:/Wheelchair/}).check();await page.getByRole("button",{name:"Find my route",exact:true}).click();await fold(page);
 await page.getByRole("button",{name:"Start simulated navigation",exact:true}).click();await page.waitForTimeout(700);await page.reload();
 await page.getByRole("button",{name:"Resume Journey",exact:true}).click();await expect(page.getByTestId("route-summary")).toContainText("Gate 2");await expect(page.getByRole("radio",{name:/Wheelchair/})).toBeChecked();await expect(page.getByTestId("simulation-status")).toHaveCount(0);
});
test("corrupted saved data offers a safe fresh start",async({page})=>{
 await page.addInitScript(()=>localStorage.setItem("railnavi-journey-v1","{broken"));await page.goto("/demo");await expect(page.getByRole("dialog")).toContainText("could not be restored");await page.getByRole("button",{name:"Start Fresh",exact:true}).click();await expect(page.getByRole("dialog")).toHaveCount(0);await expect(page.locator(".confirmed-location")).toContainText("Gate 1");
});
test("switches languages mid-route without changing the graph geometry",async({page})=>{
 await route(page);const before=await page.getByTestId("route-segment").evaluateAll(items=>items.map(i=>i.getAttribute("data-edge-id")));
 await page.getByLabel("Language",{exact:true}).selectOption("hi");await expect(page.locator("html")).toHaveAttribute("lang","hi");await expect(page.locator(".directions-list")).toContainText("जाएँ");
 expect(await page.getByTestId("route-segment").evaluateAll(items=>items.map(i=>i.getAttribute("data-edge-id")))).toEqual(before);await page.getByLabel("भाषा",{exact:true}).selectOption("en");await expect(page.getByTestId("route-summary")).toContainText("Platform 10");
});
test("offline Hindi ticket journey recovers, corrects its checkpoint and reaches a changed platform",async({page,context},info)=>{
 test.setTimeout(120000);const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto("/ticket");await page.getByRole("button",{name:/Platform 17 simulator demo/}).click();await page.getByRole("button",{name:"Find ticket",exact:true}).click();await page.getByLabel("Where are you starting?",{exact:true}).selectOption("gate-2");await page.getByRole("button",{name:"Navigate to Platform 17",exact:true}).click();
 await scanner(page,gate.id);await page.getByRole("button",{name:"Facilities",exact:true}).click();await page.getByLabel("Search facilities",{exact:true}).fill("water on my way");await page.locator(".discovery-result").first().click();await page.getByRole("button",{name:"Add stop · keep platform last",exact:true}).click();
 await save(page);await page.getByLabel("Language",{exact:true}).selectOption("hi");await page.waitForTimeout(600);await context.setOffline(true);await page.reload();await page.getByRole("button",{name:"यात्रा फिर शुरू करें",exact:true}).click();
 await expect(page.getByTestId("active-platform")).toHaveText("17");await expect(page.locator(".itinerary-list li")).toHaveCount(2);await expect(page.locator(".offline-ribbon")).toBeVisible();
 await page.getByRole("button",{name:"चेकपॉइंट स्कैन करें",exact:true}).click();await page.getByLabel("चेकपॉइंट कोड या QR लिंक").fill("RN-WEST-B-1");await page.getByRole("button",{name:"कोड जाँचें",exact:true}).click();await page.getByRole("button",{name:"इस स्थान से शुरू करें",exact:true}).click();
 await expect(page.locator(".map-topbar")).toContainText("स्तर +1");await page.getByLabel("भाषा",{exact:true}).selectOption("en");await page.getByText("Simulate platform change",{exact:true}).click();await page.getByLabel("Demo assignment",{exact:true}).selectOption("platform-11");await page.getByText("Simulate platform change",{exact:true}).click();
 await expect(page.getByTestId("active-platform")).toHaveText("11");await expect(page.locator(".directions-list li").last()).toContainText("Platform 11 boarding area");await fold(page);
 await page.getByRole("button",{name:"Start simulated navigation",exact:true}).click();await page.getByText("Demo controls",{exact:true}).click();await page.getByLabel("Simulation speed",{exact:true}).selectOption("120");await page.getByText("Demo controls",{exact:true}).click();
 await expect(page.getByTestId("simulation-status")).toHaveAttribute("data-state","at-stop",{timeout:25000});await page.getByRole("button",{name:"Continue after visit",exact:true}).click();await expect(page.getByTestId("simulation-status")).toHaveAttribute("data-state","arrived",{timeout:25000});
 await page.screenshot({path:info.outputPath("offline-arrival.png")});expect(errors).toEqual([]);
});
test("offline readiness detects evicted resources and clear data removes only app data",async({page})=>{
 await page.goto("/demo");await save(page);await page.evaluate(async()=>{localStorage.setItem("unrelated","keep");for(const key of await caches.keys())if(key.endsWith("-geometry"))await caches.delete(key);});await page.reload();await page.getByRole("button",{name:"Station & app",exact:true}).click();await expect(page.getByRole("heading",{name:"Save Station Offline",exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Clear saved RailNavi data",exact:true}).click();await expect(page.getByRole("status").last()).toContainText("cleared");expect(await page.evaluate(()=>localStorage.getItem("unrelated"))).toBe("keep");
});
test("manifest, production headers and installation guidance are valid",async({page,request})=>{
 const manifest=await(await request.get("/manifest.webmanifest")).json();expect(manifest).toMatchObject({name:"RailNavi",start_url:"/demo",display:"standalone"});expect(manifest.icons.some((i:{purpose:string})=>i.purpose.includes("maskable"))).toBe(true);
 const worker=await request.get("/sw.js");expect(worker.headers()["service-worker-allowed"]).toBe("/");expect(worker.headers()["cache-control"]).toContain("no-store");
 await page.goto("/demo");await page.getByRole("button",{name:"Station & app",exact:true}).click();await expect(page.locator(".install-card")).toContainText("browser menu");await expect(page.getByRole("heading",{name:"Installed",exact:true})).toHaveCount(0);
});
test("valid checkpoint deep link requires confirmation and print view contains real codes",async({page})=>{
 await page.goto(checkpointUrl(gate,"http://127.0.0.1:3100"));await expect(page.getByRole("heading",{name:"Confirm location",exact:true})).toBeVisible();await page.getByRole("button",{name:"Use this location",exact:true}).click();await expect(page.locator(".confirmed-location")).toContainText("Gate 2");await expect(page).toHaveURL(/\/demo$/);
 await page.goto("/checkpoints");await expect(page.locator(".print-checkpoint")).toHaveCount(6);await page.getByRole("checkbox",{name:/Show all checkpoints/}).check();await expect(page.locator(".print-checkpoint")).toHaveCount(checkpoints.length);
});
test("Hindi scanner and offline settings fit all six viewport widths with keyboard focus",async({page},info)=>{
 test.setTimeout(90000);await page.goto("/demo");await page.getByLabel("Language",{exact:true}).selectOption("hi");await page.emulateMedia({reducedMotion:"reduce"});
 for(const width of [360,390,430,768,1280,1440]){
  await page.setViewportSize({width,height:900});await page.getByRole("button",{name:"चेकपॉइंट स्कैन करें",exact:true}).click();
  await expect(page.getByRole("button",{name:"कोड जाँचें",exact:true})).toBeInViewport();expect(await page.evaluate(()=>document.body.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath(`scanner-hi-${width}.png`)});
  await page.keyboard.press("Shift+Tab");expect(await page.getByRole("dialog").evaluate(el=>el.contains(document.activeElement))).toBe(true);await page.keyboard.press("Escape");
  await page.getByRole("button",{name:"स्टेशन और ऐप",exact:true}).click();await expect(page.getByRole("button",{name:"स्टेशन ऑफ़लाइन सहेजें",exact:true})).toBeInViewport();await page.screenshot({path:info.outputPath(`settings-hi-${width}.png`)});await page.getByRole("button",{name:"बंद करें",exact:true}).click();
 }
});
