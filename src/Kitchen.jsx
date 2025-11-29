import { useState, useEffect, useRef } from 'react'
import { db } from './firebase'
import { 
  collection, query, orderBy, onSnapshot, doc, deleteDoc, addDoc, serverTimestamp 
} from 'firebase/firestore'
import './Kitchen.css'

function Kitchen() {
  const [orders, setOrders] = useState([])
  const [lastPrinted, setLastPrinted] = useState(null)
  
  // ใช้ useRef เพื่อกันการปริ้นซ้ำ และกันการทำงานตอนโหลดครั้งแรก
  const printedOrderIds = useRef(new Set()) 
  const isFirstLoad = useRef(true)

  // --- 1. ฟังก์ชันส่งคำสั่งไปแอป RawBT ---
  const sendToRawBT = (text) => {
    const sUrl = "rawbt:" + encodeURIComponent(text);
    const iframe = document.createElement("iframe");
    iframe.setAttribute("src", sUrl);
    iframe.style.display = "none";
    document.body.appendChild(iframe);
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }

  // --- 2. ฟังก์ชันจัดหน้ากระดาษใบเสร็จ ---
  const generatePrintData = (order) => {
    const timeStr = order.timestamp?.seconds 
      ? new Date(order.timestamp.seconds * 1000).toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})
      : '-';

    let text = "";
    // Init & Align Center
    text += "\x1b\x40"; 
    text += "\x1b\x61\x01"; 

    // Header
    text += "\x1d\x21\x11" + `โต๊ะ ${order.table_no || order.tableNo}` + "\n"; 
    text += "\x1d\x21\x00" + `เวลา: ${timeStr}` + "\n";
    text += "--------------------------------\n";
    
    // Items (Align Left)
    text += "\x1b\x61\x00"; 
    order.items.forEach(item => {
      text += `${item.name}`;
      if (item.qty > 1) text += `  x${item.qty}`;
      text += "\n";
      
      // Note / Options
      let details = [];
      if (item.noodle) details.push(item.noodle);
      if (item.soup) details.push(item.soup);
      if (item.size) details.push(item.size);
      if (item.note) details.push(`(${item.note})`);
      if (item.options && item.options.length > 0) details.push(`[${item.options.join(',')}]`);
      
      if (details.length > 0) {
        text += `  ${details.join(' ')}\n`;
      }
    });

    text += "--------------------------------\n";
    text += "\x1b\x61\x01"; 
    text += "จบรายการ\n\n\n"; 
    
    return text;
  }

  // --- 3. ฟังก์ชันรวมคำสั่งปริ้น ---
  const printOrder = (order) => {
      const data = generatePrintData(order);
      sendToRawBT(data);
  }

  // --- 4. ฟังก์ชัน Auto Process: ปริ้น -> บันทึกประวัติ -> ลบออกจากจอ ---
  const autoProcessOrder = async (order) => {
    try {
      console.log(`🚀 กำลังประมวลผลโต๊ะ: ${order.table_no}`);
      
      // 1. สั่งปริ้นทันที
      printOrder(order); 
      setLastPrinted(`โต๊ะ ${order.table_no} (${new Date().toLocaleTimeString()})`);

      // สร้างวันที่ YYYY-MM-DD เพื่อให้ Admin ดึงข้อมูลเจอ
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;

      // 2. บันทึกเข้า Collection 'history_orders' (แก้ตรงนี้เพื่อให้ Admin เห็น)
      await addDoc(collection(db, 'history_orders'), {
        ...order,
        status: 'served',
        finishedAt: serverTimestamp(), // ใช้ชื่อ field นี้เพื่อให้ Admin เรียงเวลาได้
        dateLabel: todayStr,           // ใช้ field นี้เพื่อให้ Admin กรองวันที่ได้
        total_price: order.total_price || order.items.reduce((sum, item) => sum + (item.price * (item.qty || 1)), 0)
      });

      // 3. ลบออกจากรายการ Orders (เพื่อให้หายไปจากหน้าจอครัวและหน้า Admin Active)
      await deleteDoc(doc(db, 'orders', order.id));
      
      console.log(`✅ Auto-processed order: ${order.id}`);
    } catch (error) {
      console.error("Error processing order:", error);
    }
  }

  // --- 5. Main Logic (Realtime Listener) ---
  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('timestamp', 'asc'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      
      if (isFirstLoad.current) {
        // โหลดครั้งแรก: แค่จำ ID ไว้ ไม่ปริ้น ไม่ลบ (กันพลาดลบออเดอร์เก่าที่ค้างมาก่อนหน้านี้)
        newOrders.forEach(o => printedOrderIds.current.add(o.id));
        setOrders(newOrders);
        isFirstLoad.current = false;
        return;
      }

      setOrders(newOrders);

      // เช็คออเดอร์ใหม่ที่เข้ามา
      newOrders.forEach(order => {
        if (!printedOrderIds.current.has(order.id)) {
          // เจอของใหม่!
          printedOrderIds.current.add(order.id);
          
          // เรียกใช้ฟังก์ชันจัดการอัตโนมัติ
          autoProcessOrder(order);
        }
      });
    })
    return () => unsubscribe()
  }, [])

  return (
    <div className="kitchen-container">
      <div className="kitchen-header">
        <h1 className="kitchen-title">👨‍🍳 ครัว (Auto Print & Clear)</h1>
        {/* แสดงสถานะล่าสุด เพื่อความอุ่นใจว่าระบบทำงานอยู่ */}
        {lastPrinted && <div style={{color:'#00e676', marginTop:'10px'}}>🖨️ ล่าสุด: {lastPrinted}</div>}
      </div>

      <div className="empty-state-kitchen">
        {/* หน้าจอจะว่างเกือบตลอดเวลา เพราะออเดอร์มาแล้วก็ไป */}
        <p style={{opacity: 0.5, fontSize: '1.2rem'}}>... รอรับคำสั่ง (เครื่องจะปริ้นอัตโนมัติ) ...</p>
        
        {/* แสดงสถานะถ้ามีออเดอร์ค้าง (กำลัง process) */}
        {orders.length > 0 && (
          <div style={{color: '#f59e0b', marginTop: '20px'}}>
             กำลังประมวลผล {orders.length} รายการ...
          </div>
        )}
      </div>
    </div>
  )
}

export default Kitchen