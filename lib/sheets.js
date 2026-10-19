'use strict';
const {APIError}=require('./validation');const {ADMIN}=require('./domain');
const EVENT_HEADERS=['id','cardid','action','payload','actor','timestamp','before'];
const MEDIA_HEADERS=['id','type',...Array.from({length:8},(_,i)=>`chunk${i+1}`)];
function assertHeader(row,expected){if(JSON.stringify(row)!==JSON.stringify(expected))throw new Error('Sheet header schema mismatch');}
function eventRow(e){const row=[e.id,e.cardId,e.action,JSON.stringify(e.payload),e.actor,e.timestamp,JSON.stringify(e.before)];if(row.some(v=>typeof v!=='string'||v.length>40000))throw new APIError(400,'Event exceeds cell limit');if(e.actor!==ADMIN||!['create','patch','delete','settings','media'].includes(e.action))throw new Error('Invalid event');return row;}
function parseEvents(rows){assertHeader(rows[0],EVENT_HEADERS);return rows.slice(1).filter(r=>r.some(Boolean)).map(r=>{if(r.length!==7||r[4]!==ADMIN)throw new Error('Invalid event row');return {id:r[0],cardId:r[1],action:r[2],payload:JSON.parse(r[3]),actor:r[4],timestamp:r[5],before:JSON.parse(r[6])};});}
class SheetsStore{
constructor(env=process.env,deps={}){this.env=env;this.id=env.GOOGLE_SHEET_ID;this.configured=Boolean(this.id||env.GOOGLE_SERVICE_ACCOUNT_JSON);this.fetch=deps.fetch||fetch;this.tokenProvider=deps.accessToken;}
async accessToken(){if(this.tokenProvider)return this.tokenProvider();if(!this.client){if(!this.id||!/^[A-Za-z0-9_-]+$/.test(this.id))throw Error('Invalid Sheets config');const c=JSON.parse(this.env.GOOGLE_SERVICE_ACCOUNT_JSON);if(!c.client_email||!c.private_key)throw Error('Missing service account');const {JWT}=require('google-auth-library');this.client=new JWT({email:c.client_email,key:c.private_key,scopes:['https://www.googleapis.com/auth/spreadsheets']});}const result=await this.client.getAccessToken();if(!result.token)throw Error('Missing access token');return result.token;}
async request(suffix,method='GET',body){if(!this.id||!/^[A-Za-z0-9_-]+$/.test(this.id))throw Error('Invalid sheet ID');const token=await this.accessToken();const r=await this.fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.id}${suffix}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Sheets request failed');return r.json();}
async values(range){return (await this.request('/values/'+encodeURIComponent(range))).values||[];}
async writeHeader(tab,headers){return this.request('/values/'+encodeURIComponent(tab+'!A1')+'?valueInputOption=RAW','PUT',{majorDimension:'ROWS',values:[headers]});}
async readEvents(){return parseEvents(await this.values('Events!A:G'));}
async appendRows(tab,rows){return this.request('/values/'+encodeURIComponent(tab==='Events'?'Events!A:G':'Media!A:J')+':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS','POST',{majorDimension:'ROWS',values:rows});}
async appendMedia(m){return this.appendRows('Media',[require('./media').mediaRow(m)]);}
async readMedia(id){const rows=await this.values('Media!A:J');assertHeader(rows[0],MEDIA_HEADERS);const row=rows.slice(1).find(r=>r[0]===id);if(!row)return null;return {id:row[0],type:row[1],bytes:Buffer.from(row.slice(2).join(''),'base64')};}
async appendEvent(e){return this.appendRows('Events',[eventRow(e)]);}
}
module.exports={SheetsStore,EVENT_HEADERS,MEDIA_HEADERS,assertHeader,eventRow,parseEvents};
