import type {GeneratedRoute} from "../navigation/types";
export function serviceTime(value:string,day=0):number{
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)||!Number.isInteger(day)||day<0)throw new Error("Use a valid fictional service-day time.");
 const [h,m]=value.split(":").map(Number);return day*86400+h!*3600+m!*60;
}
export function clockLabel(seconds:number):string{
 if(!Number.isFinite(seconds)||seconds<0)return"Invalid demo time";
 const day=Math.floor(seconds/86400),minute=Math.floor(seconds%86400/60);
 return `${day?"Day "+(day+1)+" · ":""}${String(Math.floor(minute/60)).padStart(2,"0")}:${String(minute%60).padStart(2,"0")}`;
}
export interface JourneyTiming {status:"comfortable"|"tight"|"not-recommended"|"no-ticket"|"unavailable";message:string;departureIn:number|null;walkingSeconds:number;dwellSeconds:number;arrivalSeconds:number|null;marginSeconds:number|null;bufferSeconds:number}
export function assessTiming(now:number,departure:number|undefined,route:GeneratedRoute|null,bufferSeconds=300,extraTravelSeconds=0):JourneyTiming{
 const valid=Number.isFinite(now)&&now>=0&&Number.isFinite(bufferSeconds)&&bufferSeconds>=0&&Number.isFinite(extraTravelSeconds)&&extraTravelSeconds>=0&&(!route||Number.isFinite(route.durationSeconds)&&route.durationSeconds>=0)&&(!route||Number.isFinite(route.dwellSeconds??0)&&(route.dwellSeconds??0)>=0);
 const base={departureIn:departure===undefined?null:departure-now,walkingSeconds:route?.durationSeconds??0,dwellSeconds:route?.dwellSeconds??0,arrivalSeconds:null,marginSeconds:null,bufferSeconds};
 if(!valid||!route||route.status!=="available")return{...base,status:"unavailable",message:"No valid journey estimate is available."};
 const arrival=now+route.durationSeconds+(route.dwellSeconds??0)+extraTravelSeconds;
 if(departure===undefined)return{...base,arrivalSeconds:arrival,status:"no-ticket",message:"Choose a demo train to assess departure timing."};
 if(!Number.isFinite(departure)||departure<0)return{...base,status:"unavailable",message:"The demo departure time is invalid."};
 const margin=departure-arrival-bufferSeconds;
 const status=margin<0?"not-recommended":margin<180?"tight":"comfortable";
 return{...base,arrivalSeconds:arrival,marginSeconds:margin,status,message:status==="comfortable"?"Comfortable timing":status==="tight"?"Tight timing":"Not recommended"};
}
