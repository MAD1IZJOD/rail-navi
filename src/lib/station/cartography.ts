import type {Point,Rect} from "../navigation/types";
export interface MapLabel extends Point{id:string;text:string;priority:number;kind:"platform"|"region"|"landmark"|"facility"|"gate"}
export interface Camera extends Rect{}
export const mapPalette={canvas:"#F5F7FB",structure:"#E7EDF4",platform:"#FFFFFF",track:"#D5DDE7",path:"#DBE8F7",route:"#2563EB",passenger:"#10213B",arrival:"#19BFA9"};
export function constrainCamera(camera:Camera,width:number,height:number):Camera{
 const w=Math.max(width/5,Math.min(width,camera.width)),h=w*height/width,pad=30;
 return{x:Math.max(-pad,Math.min(width-w+pad,camera.x)),y:Math.max(-pad,Math.min(height-h+pad,camera.y)),width:w,height:h};
}
export function fitPoints(points:readonly Point[],width:number,height:number,padding=100):Camera{
 if(!points.length)return{x:0,y:0,width,height};
 const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
 const w=Math.max(maxX-minX+padding*2,(maxY-minY+padding*2)*width/height,width/5);
 return constrainCamera({x:(minX+maxX-w)/2,y:(minY+maxY-w*height/width)/2,width:w,height:w*height/width},width,height);
}
/** Deterministic priority placement in CSS pixels. Hidden labels never overlap chosen labels. */
export function placeLabels(labels:readonly MapLabel[],camera:Camera,viewport:Point,fontSize=12):MapLabel[]{
 const scale=Math.min(viewport.x/camera.width,viewport.y/camera.height);
 const selected:MapLabel[]=[],boxes:Rect[]=[];
 for(const label of [...labels].sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id))){
  const x=(label.x-camera.x)*scale,y=(label.y-camera.y)*scale;
  if(x<0||y<0||x>camera.width*scale||y>camera.height*scale)continue;
  const width=Math.max(20,label.text.length*fontSize*.59)+8,height=fontSize+10;
  const box={x:x-width/2,y:y-height/2,width,height};
  if(boxes.some(b=>box.x<b.x+b.width+3&&box.x+box.width+3>b.x&&box.y<b.y+b.height+3&&box.y+box.height+3>b.y))continue;
  boxes.push(box);selected.push(label);
 }
 return selected;
}
