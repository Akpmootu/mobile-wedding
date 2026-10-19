'use strict';
function validateCover(file){if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))return 'กรุณาเลือกไฟล์ JPEG, PNG หรือ WebP';if(file.size>5*1024*1024)return 'ไฟล์ต้องมีขนาดไม่เกิน 5 MB';return '';}
async function decodeCover(file){
 if(typeof createImageBitmap==='function')return createImageBitmap(file);
 return new Promise((resolve,reject)=>{const image=new Image();const url=URL.createObjectURL(file);image.onload=()=>{URL.revokeObjectURL(url);resolve(image);};image.onerror=()=>{URL.revokeObjectURL(url);reject(Error('อ่านภาพไม่สำเร็จ กรุณาเลือกไฟล์ JPEG, PNG หรือ WebP ที่ถูกต้อง'));};image.src=url;});
}
async function compressCover(file,{decode=decodeCover,makeCanvas=()=>document.createElement('canvas')}={}){
 const error=validateCover(file);if(error)throw Error(error);
 let image;
 try{
  image=await decode(file);const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
  if(!width||!height)throw Error('ขนาดภาพไม่ถูกต้อง');
  const scale=Math.min(1,900/width,900/height);const canvas=makeCanvas();canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  const context=canvas.getContext('2d');if(!context)throw Error('เบราว์เซอร์ไม่รองรับการย่อภาพ');
  context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
  for(const quality of [.88,.78,.68,.58,.48,.38,.28,.18]){
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
   if(!blob||blob.type!=='image/jpeg')throw Error('ไม่สามารถแปลงภาพเป็น JPEG ได้');
   if(blob.size>0&&blob.size<=160*1024)return blob;
  }
  throw Error('ย่อภาพให้ไม่เกิน 160 KB ไม่สำเร็จ กรุณาเลือกภาพที่มีรายละเอียดน้อยลง');
 }finally{image?.close?.();}
}
const ALLOWED_EMAIL='akaporn1234@gmail.com';
function verifiedSession(session){return session?.authenticated===true&&session.email===ALLOWED_EMAIL&&typeof session.csrf==='string'&&session.csrf.length>0;}
async function authenticateGoogle(credential,request){
 if(typeof credential!=='string'||!credential)throw Error('Google ไม่ได้ส่งข้อมูลยืนยันตัวตน กรุณาลองใหม่');
 await request('/api/auth/google',{method:'POST',body:{credential}});
 const session=await request('/api/session');
 if(!verifiedSession(session))throw Error('ไม่สามารถยืนยันเซสชันผู้ดูแลได้ อนุญาตเฉพาะ '+ALLOWED_EMAIL);
 return session;
}
if(typeof module!=='undefined')module.exports={validateCover,compressCover,authenticateGoogle,verifiedSession};
if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',()=>{
 const $=s=>document.querySelector(s);let csrf='',cards=[],opener=null,uploading=false;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const safe=v=>{if(typeof v!=='string'||!v.trim())return '';try{const u=new URL(v,location.origin);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}};
 function message(id,text,error=false){const el=$(id);el.textContent=text;el.classList.toggle('error',error);}
 function authView(auth){$('#login-panel').hidden=auth;$('#admin-workspace').hidden=!auth;$('#logout').hidden=!auth;$('#signed-in-email').textContent=auth?ALLOWED_EMAIL:'';}
 async function api(url,{method='GET',body,raw=false}={}){const headers={};if(method!=='GET'){headers['X-CSRF-Token']=csrf;headers['Content-Type']=raw?body.type:'application/json';}const res=await fetch(url,{method,credentials:'same-origin',headers,body:body===undefined?undefined:raw?body:JSON.stringify(body)});let data={};try{data=await res.json();}catch{}if(!res.ok){if(res.status===401){const hadSession=Boolean(csrf);csrf='';authView(false);if(hadSession&&url!=='/api/auth/google'){googleReady=false;void setupGoogle();}}throw Error(data.error||data.message||`ดำเนินการไม่สำเร็จ (${res.status})`);}return data;}
 async function locked(button,action){button.disabled=true;try{await action();}finally{button.disabled=false;}}
 function render(){ $('#admin-count').textContent=`(${cards.length})`;$('#admin-empty').hidden=cards.length!==0;$('#admin-list').innerHTML=cards.map(c=>`<article class="admin-card">${safe(c.cover)?`<img src="${esc(safe(c.cover))}" alt="ภาพหน้าปก ${esc(c.title)}">`:''}<div class="admin-card-info"><h3>${esc(c.title)}</h3><p>${esc(c.category||'ไม่มีหมวดหมู่')} · ลำดับ ${esc(c.sort_order)}</p><span class="status-badge">${c.published?'เผยแพร่':'ฉบับร่าง'}${c.featured?' · แนะนำ':''}</span></div><div class="admin-card-actions"><button data-edit="${esc(c.id)}">แก้ไข</button><button data-toggle="published" data-id="${esc(c.id)}">${c.published?'ซ่อน':'เผยแพร่'}</button><button data-toggle="featured" data-id="${esc(c.id)}">${c.featured?'ยกเลิกแนะนำ':'แนะนำ'}</button><button class="danger" data-delete="${esc(c.id)}">ลบ</button></div></article>`).join('');$('#category-options').innerHTML=[...new Set(cards.map(c=>c.category).filter(Boolean))].map(c=>`<option value="${esc(c)}"></option>`).join('');}
 async function loadCards(){cards=await api('/api/admin/cards');if(!Array.isArray(cards))throw Error('รูปแบบข้อมูลการ์ดไม่ถูกต้อง');cards.sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));render();}
 async function load(){message('#global-feedback','กำลังโหลดข้อมูล…');try{await loadCards();const settings=await api('/api/settings');for(const key of ['brand','tagline','contact_url'])$('#settings-form').elements[key].value=settings[key]||'';document.querySelectorAll('[data-brand]').forEach(el=>el.textContent=settings.brand||'MOBILE WEDDING INVITATION');message('#global-feedback','');}catch(err){message('#global-feedback',err.message,true);}}
 let googleReady=false,googlePending=false;
 async function health(){
  try{const data=await api('/api/health');const sheets=data.sheets||{configured:data.sheetsConfigured,connected:data.sheetsConnected};
   if(sheets?.configured===false)message('#sheets-status','Google Sheets: ยังไม่ได้ตั้งค่า — ยังไม่เชื่อมต่อ',true);
   else if(sheets?.configured===true&&sheets.connected===true)message('#sheets-status','Google Sheets: เชื่อมต่อแล้ว');
   else if(sheets?.configured===true&&sheets.connected===false)message('#sheets-status','Google Sheets: ตั้งค่าแล้ว แต่เชื่อมต่อไม่ได้',true);
   else if(sheets?.configured===true)message('#sheets-status','Google Sheets: ตั้งค่าแล้ว — ยังไม่ยืนยันการเชื่อมต่อจริง',true);
   else message('#sheets-status','Google Sheets: ไม่สามารถยืนยันสถานะการเชื่อมต่อ',true);
  }catch(err){message('#sheets-status',`Google Sheets: ตรวจสอบการเชื่อมต่อไม่ได้ — ${err.message}`,true);}
 }
 function loadGoogle(){return new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.defer=true;
  const timer=setTimeout(()=>{script.remove();reject(Error('Google โหลดไม่สำเร็จหรือถูกบล็อก กรุณาตรวจสอบอินเทอร์เน็ตและตัวบล็อกเนื้อหา แล้วกดลองใหม่'));},15000);
  script.onload=()=>{clearTimeout(timer);if(typeof google==='undefined'||!google.accounts?.id)reject(Error('Google โหลดไม่สมบูรณ์ กรุณาลองใหม่'));else resolve();};
  script.onerror=()=>{clearTimeout(timer);script.remove();reject(Error('Google โหลดไม่สำเร็จหรือถูกบล็อก กรุณาตรวจสอบอินเทอร์เน็ตและตัวบล็อกเนื้อหา แล้วกดลองใหม่'));};document.head.appendChild(script);
 });}
 async function setupGoogle(){
  if(googleReady)return;$('#google-signin').innerHTML='';message('#login-feedback','กำลังตรวจสอบการตั้งค่า Google…');
  try{const config=await api('/api/auth/config');
   if(config.configured!==true||!config.clientId||!config.nonce)throw Error('ยังไม่ได้ตั้งค่า Google Sign-in — ไม่สามารถเข้าสู่ระบบได้ กรุณาให้ผู้ดูแลตั้งค่า Google Client ID, nonce และ Google Sheets บนเซิร์ฟเวอร์ก่อน');
   await loadGoogle();
   google.accounts.id.initialize({client_id:config.clientId,nonce:config.nonce,auto_select:false,callback:async response=>{
    if(googlePending)return;googlePending=true;$('#google-signin').setAttribute('aria-busy','true');message('#login-feedback','กำลังยืนยันบัญชี Google กับเซิร์ฟเวอร์…');
    try{const session=await authenticateGoogle(response?.credential,api);csrf=session.csrf;authView(true);message('#login-feedback','');await load();}
    catch(err){csrf='';authView(false);message('#login-feedback',err.message,true);}
    finally{googlePending=false;$('#google-signin').setAttribute('aria-busy','false');}
   }});
   google.accounts.id.renderButton($('#google-signin'),{theme:'outline',size:'large',type:'standard',text:'signin_with',shape:'pill',width:280,locale:'th'});googleReady=true;message('#login-feedback','เลือกบัญชี Google ที่ได้รับอนุญาตเท่านั้น');
  }catch(err){message('#login-feedback',err.message,true);}
 }
 $('#retry-google').onclick=async e=>{await locked(e.currentTarget,async()=>{googleReady=false;await Promise.all([setupGoogle(),health()]);});};
 $('#logout').onclick=async e=>{await locked(e.currentTarget,async()=>{try{await api('/api/logout',{method:'POST',body:{}});const session=await api('/api/session');if(session.authenticated)throw Error('ยังออกจากระบบไม่สำเร็จ กรุณาลองใหม่');csrf='';cards=[];render();authView(false);if(typeof google!=='undefined')google.accounts?.id.disableAutoSelect();message('#global-feedback','ออกจากระบบแล้ว');googleReady=false;await setupGoogle();}catch(err){message('#global-feedback',err.message,true);}});};
 const form=$('#card-form');function editor(c=null){opener=document.activeElement;form.reset();form.elements.id.value=c?.id??'';for(const key of ['title','subtitle','url','category','description','cover'])form.elements[key].value=c?.[key]||(key==='category'&&!c?'Modern':'');form.elements.sort_order.value=c?.sort_order??(cards.length?Math.max(...cards.map(x=>Number(x.sort_order)||0))+1:0);form.elements.published.checked=c?Boolean(c.published):true;form.elements.featured.checked=Boolean(c?.featured);$('#editor-title').textContent=c?'แก้ไขการ์ด':'เพิ่มการ์ด';message('#editor-feedback','');message('#upload-feedback','');preview();$('#editor-dialog').showModal();form.elements.title.focus();}
 function closeEditor(){$('#editor-dialog').close();opener?.focus();}
 function preview(){const url=safe(form.elements.cover.value);$('#upload-preview').hidden=!url;if(url)$('#upload-preview').src=url;}
 $('#add-card').onclick=()=>editor();$('#editor-close').onclick=closeEditor;$('#cancel-editor').onclick=closeEditor;$('#editor-dialog').addEventListener('cancel',e=>{e.preventDefault();closeEditor();});form.elements.cover.addEventListener('input',preview);
 $('#cover-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;const error=validateCover(file);if(error){message('#upload-feedback',error,true);e.target.value='';return;}uploading=true;$('#save-card').disabled=true;message('#upload-feedback','กำลังอัปโหลด…');try{message('#upload-feedback','กำลังย่อภาพและแปลงเป็น JPEG…');const blob=await compressCover(file);message('#upload-feedback','กำลังอัปโหลดภาพไปยัง Google Sheets…');const result=await api('/api/upload',{method:'POST',body:blob,raw:true});if(typeof result.url!=='string'||!/^\/api\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result.url))throw Error('เซิร์ฟเวอร์ไม่ได้ส่ง URL ภาพ Google Sheets ที่ถูกต้องกลับมา');form.elements.cover.value=result.url;preview();message('#upload-feedback','อัปโหลดสำเร็จ — บันทึกการ์ดเพื่อใช้ภาพนี้');}catch(err){message('#upload-feedback',err.message,true);}finally{uploading=false;$('#save-card').disabled=false;e.target.value='';}};
 form.onsubmit=async e=>{e.preventDefault();if(uploading)return;await locked($('#save-card'),async()=>{message('#editor-feedback','กำลังบันทึก…');const id=form.elements.id.value;const payload={};for(const key of ['title','subtitle','url','category','description','cover'])payload[key]=form.elements[key].value.trim();payload.cover=payload.cover||'/assets/card-1.jpg';if(!/^https?:\/\//i.test(payload.url)){message('#editor-feedback','ลิงก์เว็บไซต์ต้องขึ้นต้นด้วย http:// หรือ https://',true);return;}payload.sort_order=Number(form.elements.sort_order.value);payload.published=form.elements.published.checked;payload.featured=form.elements.featured.checked;try{const result=await api(id?`/api/cards/${encodeURIComponent(id)}`:'/api/cards',{method:id?'PUT':'POST',body:payload});await loadCards();const target=cards.find(c=>String(c.id)===String(id||result.id||result.card?.id))||(!id?cards.find(c=>c.url===payload.url&&c.title===payload.title):null);if(!target||Object.keys(payload).some(key=>['published','featured'].includes(key)?Boolean(target[key])!==payload[key]:key==='sort_order'?Number(target[key])!==payload[key]:String(target[key]??'')!==payload[key]))throw Error('ข้อมูลที่อ่านกลับไม่ตรงกับการบันทึก กรุณารีเฟรช');closeEditor();message('#global-feedback','บันทึกการ์ดแล้ว');}catch(err){message('#editor-feedback',err.message,true);}});};
 $('#admin-list').onclick=async e=>{const edit=e.target.closest('[data-edit]');if(edit){editor(cards.find(c=>String(c.id)===edit.dataset.edit));return;}const del=e.target.closest('[data-delete]');const toggle=e.target.closest('[data-toggle]');const button=del||toggle;if(!button)return;const id=del?del.dataset.delete:toggle.dataset.id;const c=cards.find(c=>String(c.id)===id);if(!c)return;if(del&&!confirm(`ลบการ์ด “${c.title}” อย่างถาวร?`))return;await locked(button,async()=>{try{if(del){await api(`/api/cards/${encodeURIComponent(id)}`,{method:'DELETE'});await loadCards();if(cards.some(x=>String(x.id)===id))throw Error('ยังพบการ์ดหลังลบ กรุณาลองใหม่');}else{const field=toggle.dataset.toggle;const desired=!c[field];await api(`/api/cards/${encodeURIComponent(id)}`,{method:'PUT',body:{[field]:desired}});await loadCards();if(Boolean(cards.find(x=>String(x.id)===id)?.[field])!==desired)throw Error('การเปลี่ยนแปลงยังไม่ถูกบันทึก');}message('#global-feedback',del?'ลบการ์ดแล้ว':'อัปเดตการ์ดแล้ว');}catch(err){message('#global-feedback',err.message,true);}});};
 $('#settings-form').onsubmit=async e=>{e.preventDefault();await locked(e.submitter,async()=>{const payload={};for(const key of ['brand','tagline','contact_url'])payload[key]=e.target.elements[key].value.trim();if(payload.contact_url&&!/^https?:\/\//i.test(payload.contact_url)){message('#settings-feedback','ลิงก์ติดต่อต้องขึ้นต้นด้วย http:// หรือ https://',true);return;}message('#settings-feedback','กำลังบันทึก…');try{await api('/api/settings',{method:'POST',body:payload});const saved=await api('/api/settings');if(Object.keys(payload).some(key=>saved[key]!==payload[key]))throw Error('ข้อมูลที่อ่านกลับไม่ตรง กรุณาลองใหม่');document.querySelectorAll('[data-brand]').forEach(el=>el.textContent=saved.brand||'MOBILE WEDDING INVITATION');message('#settings-feedback','บันทึกการตั้งค่าแล้ว');}catch(err){message('#settings-feedback',err.message,true);}});};
 $('#refresh-cards').onclick=()=>Promise.all([load(),health()]);
 health();
 (async()=>{authView(false);message('#global-feedback','กำลังตรวจสอบเซสชัน…');try{const session=await api('/api/session');const authenticated=verifiedSession(session);csrf=authenticated?session.csrf:'';authView(authenticated);if(authenticated)await load();else{message('#global-feedback','');await setupGoogle();}}catch(err){csrf='';authView(false);message('#global-feedback',`ตรวจสอบเซสชันไม่ได้: ${err.message}`,true);await setupGoogle();}})();
});
