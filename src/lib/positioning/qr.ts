import {BarcodeFormat,EncodeHintType,QRCodeWriter} from "@zxing/library";
/** Real ISO QR encoding. Paths are generated only from the library's boolean matrix. */
export function qrMatrix(value:string){
 if(!value||value.length>512)throw new Error("Invalid QR input");
 const hints=new Map<EncodeHintType,unknown>([[EncodeHintType.MARGIN,4]]);
 const matrix=new QRCodeWriter().encode(value,BarcodeFormat.QR_CODE,0,0,hints);
 let path="";
 for(let y=0;y<matrix.getHeight();y++)for(let x=0;x<matrix.getWidth();x++)if(matrix.get(x,y))path+=`M${x} ${y}h1v1h-1z`;
 return{path,size:matrix.getWidth()};
}
