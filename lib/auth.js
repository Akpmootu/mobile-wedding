'use strict';
const crypto=require('node:crypto');const {APIError}=require('./validation');const {ADMIN}=require('./domain');
function auth(env){const secret=env.SESSION_SECRET||'';const configured=Boolean(env.GOOGLE_CLIENT_ID&&secret.length>=32);const secure=env.NODE_ENV==='production'||!!env.VERCEL;
function sign(payload){if(secret.length<32)throw new APIError(503,'Authentication is not configured');const body=Buffer.from(JSON.stringify(payload)).toString('base64url');return body+'.'+crypto.createHmac('sha256',secret).update(body).digest('base64url');}
function read(value,kind){try{if(secret.length<32)return null;const [body,sig,...extra]=(value||'').split('.');if(extra.length||!body||!sig)return null;const expected=crypto.createHmac('sha256',secret).update(body).digest('base64url');if(!equal(sig,expected))return null;const data=JSON.parse(Buffer.from(body,'base64url'));if(data.kind!==kind||!Number.isFinite(data.exp)||data.exp<=Date.now())return null;return data;}catch{return null;}}
function cookie(name,value,maxAge){return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Strict${secure?'; Secure':''}`;}
function session(req){const s=read(cookies(req).wedding_session,'session');return s&&s.email===ADMIN?s:null;}
function challenge(){const nonce=crypto.randomBytes(32).toString('base64url');return {nonce,cookie:cookie('wedding_nonce',sign({kind:'nonce',nonce,exp:Date.now()+600000}),600)};}
function makeSession(){const s={kind:'session',email:ADMIN,csrf:crypto.randomBytes(32).toString('base64url'),exp:Date.now()+8*3600000};return {session:s,cookie:cookie('wedding_session',sign(s),8*3600)};}
return {configured,session,challenge,makeSession,read,cookie};}
function equal(a,b){if(typeof a!=='string'||typeof b!=='string')return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&crypto.timingSafeEqual(x,y);}
function cookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').map(s=>s.trim().split(/=(.*)/s).slice(0,2)).filter(x=>x.length===2));}
function originCheck(req,env){let expected;try{if(env.APP_ORIGIN){const u=new URL(env.APP_ORIGIN);if(u.origin!==env.APP_ORIGIN||!['https:','http:'].includes(u.protocol))throw Error();expected=u.origin;}else{const host=req.headers.host;if(typeof host!=='string'||!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.vercel\.app$/.test(host)||!env.VERCEL)throw Error();const allowed=[env.VERCEL_URL,env.VERCEL_PROJECT_PRODUCTION_URL].filter(Boolean);if(!allowed.includes(host))throw Error();expected='https://'+host;}}catch{throw new APIError(503,'APP_ORIGIN is not configured');}if(req.headers.origin!==expected)throw new APIError(403,'Origin not allowed');}
async function verifyGoogle(credential,audience){const {OAuth2Client}=require('google-auth-library');const ticket=await new OAuth2Client(audience).verifyIdToken({idToken:credential,audience});return ticket.getPayload();}
module.exports={auth,equal,cookies,originCheck,verifyGoogle};
