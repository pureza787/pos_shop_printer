# 🍽️ ระบบ POS สแกนสั่งอาหารจัดการออร์เดอร์ปริ้นออกมาเป็นใบออร์เดอร์ (Restaurant POS Web App)

ระบบจัดการร้านอาหารแบบครบวงจร (Point of Sale) รูปแบบ Web Application ที่ไม่ต้องติดตั้งแอป  
รองรับการทำงาน 3 ส่วน: ลูกค้าสั่งอาหาร, จอภาพห้องครัว, และระบบหลังบ้านเจ้าของร้าน

---
# 🔗 คลิกลิงก์เพื่อดูโปรเจ็กต์

### 🍽️ โต๊ะ (เปลี่ยนเลข table ได้)
- [โต๊ะ 1]เปลี่ยนเลข 1 เป็นเลขโต๊ะ(https://pos-shop-iota.vercel.app/?table=1)

### 🧑‍💼 Admin รหัส8888
- [หน้า Admin](https://pos-shop-iota.vercel.app/admin)

### 👨‍🍳 ครัว
- [หน้า Kitchen](https://pos-shop-iota.vercel.app/Kitchen)


## 👨‍💻 พัฒนาโดย  
 นายโชติวัฒน์ แก้วลา (Chotiwat Kaewla)

## 📌 สถานะ  
 โปรเจกต์เพื่อการศึกษา (Educational Project)

## 🪪 ลิขสิทธิ์  
**ฟรี — ห้ามจำหน่าย** (Free to Use)  
อนุญาตให้นำไปศึกษาหรือใช้งานได้โดยไม่มีค่าใช้จ่าย

---

# ✨ ฟีเจอร์เด่น (Key Features)

## 📱 1. สำหรับลูกค้า (Customer Ordering)
- Scan & Order: ลูกค้าสแกน QR Code เพื่อสั่งอาหารที่โต๊ะได้ทันที  
- Smart Table: ระบบอ่านเลขโต๊ะจาก QR โดยอัตโนมัติ  
- Customization: เพิ่มท็อปปิ้ง เลือกระดับความหวาน หรือเพิ่ม Note เช่น "ไม่ใส่ผัก"

## 👨‍🍳 2. สำหรับห้องครัว (Kitchen Display System - KDS)
- Real-time Alert: ออเดอร์ใหม่เด้งขึ้นทันที พร้อมเสียงแจ้งเตือน  
- Order Status Flow (3 สถานะ)  
  - 🔴 New – ออเดอร์ใหม่  
  - 🟡 Ready – ทำเสร็จแล้ว  
  - 🟢 Served – เสิร์ฟแล้ว  
- Bill Printing: รองรับเครื่องพิมพ์ใบเสร็จ (Thermal Printer)

## ⚙️ 3. สำหรับผู้ดูแลระบบ (Admin Dashboard)
- Sales Insight: ดูยอดขายรายวัน จำนวนออเดอร์ และเมนูขายดี  
- Menu Management: เพิ่ม/ลบ/แก้ไขรายการอาหาร พร้อมอัปโหลดภาพ  
- Instant Update: เปิด/ปิดเมนู (Sold Out) ได้ทันที  
- Security: ระบบ PIN Lock ป้องกันการเข้าถึงโดยไม่ได้รับอนุญาต

---

# 🛠️ วิธีติดตั้งและเริ่มต้นใช้งาน (Installation)

หากต้องการรันโปรเจกต์บนเครื่องของคุณ (Local Development) ให้ทำตามนี้:

## 📋 สิ่งที่ต้องเตรียม (Prerequisites)
- Node.js: https://nodejs.org/en  
- VS Code (สำหรับแก้โค้ด)

---

# 🔥 Firebase Account: สำหรับระบบฐานข้อมูล

## 🚀 ขั้นตอนการติดตั้ง (Setup Steps)

---

## 1️⃣ ติดตั้ง Dependencies  
เปิด Terminal ในโฟลเดอร์โปรเจกต์ แล้วพิมพ์:

```diff
+ npm install
2️⃣ ตั้งค่าฐานข้อมูล (Firebase)
ไปที่ https://console.firebase.google.com/

สร้างโปรเจกต์ใหม่

เข้าสู่เมนู Firestore Database
→ กด Create Database
→ เลือก Start in test mode

ไปที่ Project Settings
→ เลื่อนลงล่างสุด
→ กดไอคอน </> Web App

คัดลอก firebaseConfig แล้วใส่ในไฟล์:
src/firebase.js

3️⃣ รันโปรเจกต์ (Run Local)
พิมพ์คำสั่ง:


คัดลอกโค้ด
+ npm run dev
เว็บจะเปิดที่
👉 http://localhost:5173

☁️ การอัปโหลดขึ้นออนไลน์ (Deploy to Vercel)
เพื่อให้ใช้งานได้บนมือถือโดยไม่ต้องเปิดคอม แนะนำให้ใช้ Vercel

1️⃣ ติดตั้ง Vercel CLI

คัดลอกโค้ด
+ npm i -g vercel
2️⃣ ล็อกอิน

คัดลอกโค้ด
+ npx vercel login
3️⃣ อัปโหลดขึ้น Server (Deploy)

คัดลอกโค้ด
+ npx vercel --prod
(กด Enter ใช้ค่า default ทุกข้อ)

🔗 ลิงก์เข้าใช้งาน (Access Links)
เมื่อ Deploy เสร็จ คุณจะได้ URL เช่น:

arduino
คัดลอกโค้ด
https://my-shop.vercel.app
ให้นำไปต่อด้วย path ตามบทบาทผู้ใช้งาน:


คัดลอกโค้ด
+ ลูกค้า: .../#/?table=1        ← เปลี่ยนเลข 1 เป็นเลขโต๊ะ  
+ ห้องครัว: .../#/kitchen       ← สำหรับจอครัว  
+ แอดมิน:   .../#/admin         ← สำหรับเจ้าของร้าน  
จากนั้นนำลิงก์ลูกค้าไปสร้าง QR Code สำหรับให้ลูกค้าสแกนสั่งอาหาร
Enjoy Coding! ขอให้สนุกกับการใช้งานครับ ❤️


