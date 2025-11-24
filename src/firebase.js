import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// ▼▼▼ เริ่ม: เอาโค้ดจากหน้าเว็บ Firebase ของคุณ มาแปะทับตรงนี้ ▼▼▼
const firebaseConfig = {
  apiKey: "AIzaSyDMFfuxMUls4x_X8vGvWEZ8rfj1PElv3KE",
  authDomain: "pos-shop-bbe62.firebaseapp.com",
  projectId: "pos-shop-bbe62",
  storageBucket: "pos-shop-bbe62.firebasestorage.app",
  messagingSenderId: "391432804634",
  appId: "1:391432804634:web:d2ca1f34d062b8b39d74a3"
};

// ▲▲▲ จบ: ส่วนที่ต้องแก้ ▲▲▲

// เริ่มระบบ Firebase
const app = initializeApp(firebaseConfig);

// ส่งออกระบบ Database (Firestore) ให้ไฟล์อื่นเอาไปใช้
export const db = getFirestore(app);