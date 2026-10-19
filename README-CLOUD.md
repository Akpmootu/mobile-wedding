# Cloud backend: Google Sign-In + private Google Sheets

## สถานะและขอบเขต

Node.js CommonJS serverless handler อยู่ที่ `api/index.js`; ไม่มี SQLite หรือการเขียนไฟล์ถาวรใน production. `public/` เป็น static output ของ Vercel. ยัง **ไม่ได้เชื่อม Google จริงหรือ deploy จริง** จนกว่าจะใส่ credentials และตรวจสอบ production; tests ใช้ local HTTP และ provider doubles ที่ระบุชัดเจน ไม่ใช่ผลตรวจสอบ Google จริง.

บัญชีผู้ดูแลอนุญาตเฉพาะ **akaporn1234@gmail.com** เท่านั้น (exact comparison, ต้อง `email_verified === true`). ไม่มี registration, password หรือ OAuth token ที่เชื่อจาก client โดยไม่ตรวจสอบ. ID token ตรวจ signature, issuer, audience และ expiry ผ่าน `google-auth-library`; nonce ตรวจเพิ่มบน server.

## ตั้งค่า Google Cloud / Vercel

1. ใน Google Cloud project เปิด **Google Sheets API**. ตั้ง OAuth consent screen/Google Auth Platform และสร้าง OAuth client ประเภท **Web application**.
2. ใส่ **Authorized JavaScript origins** เป็น origin จริง เช่น `https://your-project.vercel.app` และ custom domain ที่ใช้; localhost ต้องตรง port ที่ใช้งาน เช่น `http://localhost:8765`. origin ไม่มี path และไม่มี trailing slash. ถ้า consent screen อยู่ Testing ให้เพิ่ม `akaporn1234@gmail.com` เป็น test user. GIS callback แบบ JavaScript นี้ไม่ต้องใช้ redirect-based login.
3. ตั้ง `GOOGLE_CLIENT_ID` เป็น Web OAuth client ID. ห้ามใช้ service-account client ID แทน.
4. สร้าง service account และ key JSON (เก็บส่วนตัว). ให้เจ้าของ spreadsheet บัญชี `akaporn1234@gmail.com` แชร์ **spreadsheet เดิม** ให้ service account `client_email` เป็น **Editor**. ไม่ต้อง Publish to web, ไม่ต้องแชร์ Anyone with link. Server ไม่สร้าง spreadsheet ใหม่.
5. ตั้ง `GOOGLE_SHEET_ID` เป็น ID ของ spreadsheet นั้นเท่านั้น. ตั้ง `GOOGLE_SERVICE_ACCOUNT_JSON` เป็น JSON เต็มใน server environment. ใน `.env` ใช้ JSON บรรทัดเดียวครอบด้วย single quotes เพื่อคง `\n` ใน private key. บน Vercel วาง JSON ตรง ๆ ใน environment value ไม่ใส่ shell quotes.
6. ตั้ง `SESSION_SECRET` เป็น random secret อย่างน้อย 32 ตัวอักษร เช่น `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. ตั้ง `APP_ORIGIN` เป็น production HTTPS origin ที่ตรงกับหน้า admin. ห้ามใช้ wildcard หรือ trailing slash. เมื่อไม่กำหนด APP_ORIGIN จะยอมรับเฉพาะ Host `.vercel.app` ที่ตรง `VERCEL_URL` หรือ `VERCEL_PROJECT_PRODUCTION_URL`; custom domain ต้องกำหนด APP_ORIGIN.
7. เพิ่ม environment ทั้งหมดใน Vercel project (Production/Preview ตามต้องการ) แล้ว deploy ใหม่. `GOOGLE_SERVICE_ACCOUNT_JSON` และ `SESSION_SECRET` เป็น server secrets ห้ามใส่ public build variables, source code หรือ frontend. Vercel เลือก framework **Other**, root เป็น repository, Node 24, output directory `public`; `vercel.json` กำหนด API rewrite และ clean URLs.

## Initialize: ทำเฉพาะเครื่อง local โดยยืนยันชัดเจน

ติดตั้ง dependencies จาก package.json ก่อน. คัดลอก `.env.example` เป็น `.env` และใส่ค่าจริง:

```sh
node --env-file=.env scripts/init-sheet.js --confirm
```

คำสั่งนี้แก้ไข spreadsheet ที่ pin ใน env เท่านั้น: ตรวจ schema ที่มีอยู่ทุก tab ก่อนเขียน, เพิ่มเฉพาะ Events/Media ที่ขาด, ใส่ header ให้ tab ว่าง, seed เฉพาะ stable card IDs ที่ไม่เคยมี event. อ่านกลับ header/seed IDs ก่อนรายงานผล. รันซ้ำได้; edited/deleted seed IDs ไม่ถูกสร้างใหม่. ห้ามรัน bootstrap พร้อมกันสองเครื่อง. ถ้า header ผิดจะหยุดแทน overwrite ข้อมูลเดิม. ไม่มี migration endpoint ที่เปิด public.

## Schema

**Events** แถวแรก (ลำดับต้องตรง):

`id | cardid | action | payload | actor | timestamp | before`

- `id`: UUID v4 ของ event (รวม seed events); bootstrap idempotency ใช้ stable cardid ไม่ใช่ event ID.
- `cardid`: UUID ของ card หรือ stable `seed-1` … `seed-8`; settings ใช้ค่าว่าง; media ใช้ image UUID.
- `action`: `create`, `patch`, `delete`, `settings`, `media`.
- `payload`: JSON object; patch เก็บเฉพาะ field ที่ส่ง ไม่ overwrite ทั้ง card; settings เฉพาะ brand/tagline/contact_url; media เก็บ type/size ไม่เก็บ base64.
- `actor`: server-verified `akaporn1234@gmail.com`; bootstrap ใช้บัญชีผู้ดูแลเดียวกันเป็น provenance ของ local operation.
- `timestamp`: ISO UTC; `before`: JSON snapshot เดิม หรือ `null` เมื่อ create/media.
- จำกัดแต่ละ cell ไม่เกิน 40,000 characters. เขียนด้วย Sheets `values.append`, `valueInputOption=RAW`, ทีละแถว atomic; ไม่มี whole-sheet replacement. Reducer ใช้ลำดับแถว, duplicate event IDs ไม่ fold ซ้ำ, delete เป็น tombstone. Default settings ไม่อ่าน secrets จาก env.

**Media** แถวแรก:

`id | type | chunk1 | chunk2 | chunk3 | chunk4 | chunk5 | chunk6 | chunk7 | chunk8`

Base64 แบ่งไม่เกิน 40,000 characters ต่อ chunk; upload หนึ่งไฟล์ append หนึ่งแถว. รองรับ PNG/JPEG/WebP signature ขั้นพื้นฐาน สูงสุด 200 KiB raw; admin ควร compress JPEG ไม่เกิน 160 KiB. รูปเป็น portfolio public; `/api/media/:uuid` ไม่มี login/cookies และตอบ MIME จริง. ไม่ใช่ storage สำหรับภาพส่วนตัว. การ append media สำเร็จแต่ audit append ล้มเหลวจะตอบ 503 และอาจเหลือ orphan image; ตรวจแถว Media/Events ก่อน retry. ไม่มี automatic retry write ที่อาจ append ซ้ำ.

## API contract สำหรับ frontend

- `GET /api/auth/config` → `{configured,clientId,nonce}`; เผยเฉพาะ public OAuth client ID. Signed HttpOnly nonce cookie อายุ 10 นาที.
- ส่ง nonce นี้ให้ GIS `google.accounts.id.initialize({client_id, nonce, callback})`. callback POST `/api/auth/google` JSON `{credential,nonce}` โดย same-origin fetch. Google ID token ต้องมี nonce ตรง signed challenge. ล้าง nonce cookie เมื่อใช้งาน.
- `GET /api/session` → `{authenticated,email,csrf}`. Session เป็น signed HMAC cookie อายุ 8 ชั่วโมง, HttpOnly, SameSite=Strict; Secure เมื่อ production/Vercel. Logout ล้าง cookie; stateless session ที่ถูกขโมยยังใช้ได้จนหมดอายุ (เปลี่ยน SESSION_SECRET เพื่อ revoke ทุก session).
- `POST /api/logout`: session + `X-CSRF-Token` + Origin ที่ตรง config.
- `GET /api/cards` → published cards array เรียง sort_order; `GET /api/admin/cards` → ทุก card แต่ต้อง login และ Sheets configured.
- `POST /api/cards`, `PUT /api/cards/:id`, `DELETE /api/cards/:id`: session + CSRF; POST/PUT รับเฉพาะ `title,subtitle,url,category,description,cover,featured,published,sort_order`; PUT partial. IDs เป็น string (ไม่ใช่ integer). Category: Romance/Classic/Minimal/Modern. URLs เป็น public HTTPS ไม่รับ credentials/local/private IP literals; cover เป็น safe `/assets/name.jpg` หรือ `/api/media/:uuid` เท่านั้น. POST 201, PUT 200 ตอบ card object; DELETE 200 `{ok:true}`.
- `GET /api/settings` → `{brand,tagline,contact_url}`; `POST /api/settings` partial fields เท่านั้น พร้อม auth/CSRF. ค่าเริ่มต้น brand `MOBILE WEDDING INVITATION`, tagline `ลิงก์เดียวจบ ครบเรื่องการ์ดแต่งงาน`, contact `https://line.me/ti/p/R8xclmk6fX`.
- `POST /api/upload`: raw image body และ Content-Type `image/jpeg`, `image/png` หรือ `image/webp` + session/CSRF; 201 `{url:'/api/media/:uuid'}`.
- `GET /api/health` → `{ok,googleSignInConfigured,sheetsConfigured,source}`. เป็น configuration liveness ไม่ใช่การรับรองว่า Google credentials ใช้งานได้.
- ขณะไม่ตั้งค่า Sheets อ่าน public cards/settings จาก seeds พร้อม header `X-Data-Source: seed`. หากเริ่มตั้งค่า Sheets แล้วอ่านล้มเหลวจะ 503 **ไม่ fallback**. mutation ที่ไม่มี session เป็น 401 ก่อนตรวจ datastore. Google login ไม่ตั้งค่าเป็น 503.

## ข้อจำกัดและการตรวจรับ

Sheets append ป้องกัน lost updates สำหรับ independent field patches แต่ไม่มี transaction/unique constraint: duplicate URL check เป็น read-before-append; **concurrent creates/URL edits อาจผ่าน check ทั้งคู่**. ใช้ผู้ดูแลหนึ่งคนและอย่าส่ง mutation ซ้อนกัน; ถ้าต้องรับประกัน uniqueness ข้ามหลาย serverless instances ต้องเพิ่ม datastore ที่มี transactional unique constraints/การ serialize แบบ durable. ห้ามอ้างว่า mutex ใน Node แก้ข้าม instance ได้. Before snapshot อาจเก่าหากแก้พร้อมกัน. Sheets full-log reads เหมาะกับ portfolio ขนาดเล็ก; ไม่ใช่ media CDN ขนาดใหญ่.

```sh
node --test tests/cloud*.cjs
```

Tests ใช้ Node builtins/local HTTP, stateful fake Sheets และ injected fake Google verifier; network integration จริงยังต้องทดสอบหลังมี credentials: initialize สองครั้ง, login ด้วยบัญชีอนุญาต, ปฏิเสธบัญชีอื่น, create/edit/delete card แล้วอ่าน Events กลับ, upload แล้วอ่าน Media bytes กลับ, ตรวจ static `/`, `/admin`, `/assets/card-1.jpg` และ API บน deployment จริง. อย่าอ้างว่า live integration ผ่านจาก tests เหล่านี้.

## เอกสารอ้างอิงหลัก

- Google ID token verification: https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
- GIS nonce configuration: https://developers.google.com/identity/gsi/web/reference/js-reference#nonce
- Sheets append: https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/append
- Google JWT client: https://docs.cloud.google.com/nodejs/docs/reference/google-auth-library/latest/google-auth-library/jwt
- Vercel configuration: https://vercel.com/docs/project-configuration/vercel-json
