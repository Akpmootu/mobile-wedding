# MOBILE WEDDING INVITATION

ลิงก์เดียวจบ ครบเรื่องการ์ดแต่งงาน — เว็บไซต์แสดงผลงานการ์ดแต่งงานออนไลน์

## หน้าลูกค้า

- Landing page โทนงานแต่งสว่าง พร้อมแพ็กเกจราคาเดียว **1,999 บาท**
- ที่มาของบริการ ขั้นตอนสั่งซื้อ และติดต่อ LINE พร้อม QR ต้นฉบับ
- แกลลอรี่ 8 ลิงก์เริ่มต้น ค้นหา หมวดหมู่ รายการโปรด และรายละเอียดภายในหน้าเดิม
- พรีวิวสดเปิดเมื่อผู้ชมกดเท่านั้น พร้อมปุ่มเว็บไซต์ต้นฉบับสำรอง
- กรอบ iPhone 18 Pro Max เป็น **design concept** ไม่ใช่การยืนยันสเปกหรือสัดส่วนผลิตภัณฑ์จริง

## หลังบ้านและข้อมูล

- Google Sign-in: อนุญาตเฉพาะบัญชี `akaporn1234@gmail.com` ที่ Google ยืนยันอีเมลแล้ว
- ไม่มีระบบสมัครสมาชิกทั่วไปหรือรหัสผ่านสำรองในเวอร์ชัน Cloud
- ใช้ Google Sheets แบบ private ผ่าน server-side service account เท่านั้น
- บันทึกข้อมูลแบบ append-only Events พร้อม actor และ timestamp; ภาพที่อัปโหลดบีบอัดและจัดเก็บเป็น chunks ใน Media tab
- ค่า Google credentials อยู่ใน Vercel Environment Variables ไม่อยู่ใน repository หรือ frontend
- ต้องตั้งค่า Google จริงก่อนใช้หลังบ้าน หากยังไม่ตั้งค่า หน้าสาธารณะแสดงชุดผลงานเริ่มต้นเท่านั้น ไม่ใช่ข้อมูลที่ซิงก์จาก Sheets
- ดูรายละเอียดการตั้งค่าและ schema ใน [README-CLOUD.md](README-CLOUD.md)

## เริ่มบนเครื่อง

ต้องใช้ Node.js 24

```sh
npm ci
npm run dev
```

เปิด `http://127.0.0.1:3000` และ `/admin.html`

ตั้งค่าที่จำเป็นใน `.env.local` ตาม `.env.example` สำหรับใช้งาน Google จริง ห้าม commit ไฟล์ `.env.local`

```sh
npm test
npm run lint
npm run build
npm run sheets:init
```

`sheets:init` ใช้กับ Spreadsheet ที่ตั้งค่าไว้เท่านั้น และควรตรวจสอบบัญชี/ID ให้ตรงก่อนรัน

## Vercel

โปรเจกต์ `mobile-wedding` ใช้ static output `public/` และ Node serverless API `api/index.js` เชื่อม GitHub `Akpmootu/mobile-wedding`

```sh
npx vercel --prod
```

ตั้งค่า Google OAuth JavaScript origins ให้ตรงกับโดเมน production และ localhost ที่จะใช้ ระบบตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์ ไม่ใช้การซ่อนปุ่มเป็นการรักษาความปลอดภัย

## ข้อจำกัดที่ควรรู้

- การฝัง iframe ขึ้นกับนโยบายของเว็บไซต์ผลงานแต่ละแห่ง จึงมีปุ่มเปิดเว็บต้นฉบับเสมอ
- Wix บางเว็บไซต์ใช้ canvas 980px: wrapper ปรับสเกลโดยไม่แก้เว็บต้นฉบับ
- Google Sheets มี quota และไม่ใช่ฐานข้อมูล/ที่เก็บรูปสำหรับงานปริมาณสูง ควรย้ายภาพไป object storage เมื่อขยายงาน
- เนื้อหาแพ็กเกจอธิบายบริการทำ E-wedding card ไม่ได้หมายความว่าตัวอย่างทุกเว็บมีฟีเจอร์เหมือนกันทั้งหมด
- ไม่กำหนดระยะเวลาใช้งาน จำนวนรูป จำนวนแก้ไข หรือกำหนดส่งที่เจ้าของยังไม่ได้ยืนยัน

## เวอร์ชันเดิม

`legacy/` เก็บ Python/SQLite รุ่นทดสอบเดิมไว้เพื่ออ้างอิง ไม่ถูกนำขึ้น Vercel และไม่ใช่ระบบหลังบ้าน Cloud ปัจจุบัน
