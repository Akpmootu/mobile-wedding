'use strict';
const {APIError}=require('./validation');
function validateImage(bytes,type){if(bytes.length>200*1024)throw new APIError(413,'Image exceeds 200KB');const png=type==='image/png'&&bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));const jpeg=type==='image/jpeg'&&bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes.at(-2)===255&&bytes.at(-1)===217;const webp=type==='image/webp'&&bytes.length>=12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';if(!png&&!jpeg&&!webp)throw new APIError(400,'PNG, JPEG or WebP signature required');return bytes;}
function mediaRow(m){validateImage(m.bytes,m.type);const b=m.bytes.toString('base64'),chunks=Array.from({length:8},(_,i)=>b.slice(i*40000,(i+1)*40000));return [m.id,m.type,...chunks];}
module.exports={validateImage,mediaRow};
