import { useState, useEffect, useRef } from 'react'
import { db } from './firebase'
import { 
  collection, query, onSnapshot, doc, updateDoc // เปลี่ยน deleteDoc เป็น updateDoc
} from 'firebase/firestore'
import './Kitchen.css'

function Kitchen() {
  const [orders, setOrders] = useState([])
  const [lastPrinted, setLastPrinted] = useState(null)
  
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

    let text = "\x1b\x40\x1b\x61\x01\x1d\x21\x11" + `โต๊ะ ${order.table_no || order.tableNo}\n`; 
    text += "\x1d\x21\x00" + `เวลา: ${timeStr}\n--------------------------------\n\x1b\x61\x00`;
    
    order.items.forEach(item => {
      text += `${item.name}`;
      if (item.qty > 1) text += `  x${item.qty}`;
      text += "\n";
      
      let details = [];
      if (item.noodle) details.push(item.noodle);
      if (item.soup) details.push(item.soup);
      if (item.size) details.push(item.size);
      if (item.note) details.push(`(${item.note})`);
      if (item.options && item.options.length > 0) details.push(`[${item.options.join(',')}]`);
      
      if (details.length > 0) text += `  ${details.join(' ')}\n`;
    });

    text += "--------------------------------\n\x1b\x61\x01จบรายการ\n\n\n"; 
    return text;
  }

  const printOrder = (order) => {
      const data = generatePrintData(order);
      sendToRawBT(data);
  }

  // --- 4. ฟังก์ชัน Auto Process: ปริ้น -> อัปเดตสถานะ (ไม่ลบ) ---
  const autoProcessOrder = async (order) => {
    try {
      console.log(`🚀 Processing Table: ${order.table_no}`);
      
      // 1. สั่งปริ้น
      printOrder(order); 
      setLastPrinted(`โต๊ะ ${order.table_no} (${new Date().toLocaleTimeString()})`);

      // 2. แก้ไข: เปลี่ยนสถานะเป็น served แทนการลบทิ้ง!
      // เพื่อให้ Admin ยังเห็นรายการนี้อยู่ และกดเก็บเงินได้
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'served'
      });
      
      console.log(`✅ Auto-processed order: ${order.id}`);
    } catch (error) {
      console.error("Error processing order:", error);
    }
  }

  // --- 5. Main Logic ---
  useEffect(() => {
    // ลบ orderBy ออก เพื่อกัน Error เรื่อง Index
    const q = query(collection(db, 'orders'))
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let allOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      
      // เรียงลำดับเองใน JS (เก่า -> ใหม่)
      allOrders.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));

      if (isFirstLoad.current) {
        allOrders.forEach(o => printedOrderIds.current.add(o.id));
        // กรองเฉพาะที่ยังทำไม่เสร็จแสดงบนจอครัว
        setOrders(allOrders.filter(o => o.status === 'kitchen'));
        isFirstLoad.current = false;
        return;
      }

      // เช็คออเดอร์ใหม่ (เฉพาะสถานะ kitchen)
      allOrders.forEach(order => {
        if (order.status === 'kitchen' && !printedOrderIds.current.has(order.id)) {
          printedOrderIds.current.add(order.id);
          autoProcessOrder(order);
        }
      });

      // อัปเดตหน้าจอ (แสดงเฉพาะรายการที่ยังไม่ได้เสิร์ฟ หรือจะแสดงหมดก็ได้แล้วแต่ชอบ)
      // ในที่นี้ให้แสดงเฉพาะที่สถานะเป็น 'kitchen' เพื่อให้รู้ว่ามีอะไรต้องทำบ้าง
      setOrders(allOrders.filter(o => o.status === 'kitchen'));
    })
    return () => unsubscribe()
  }, [])

  return (
    <div className="kitchen-container">
      <div className="kitchen-header">
        <h1 className="kitchen-title">👨‍🍳 ครัว (Auto Print)</h1>
        {lastPrinted && <div style={{color:'#00e676', marginTop:'10px'}}>🖨️ ล่าสุด: {lastPrinted}</div>}
      </div>

      <div className="empty-state-kitchen">
        {orders.length === 0 ? (
           <p style={{opacity: 0.5, fontSize: '1.2rem'}}>... รอรับคำสั่ง ...</p>
        ) : (
           <div style={{color: '#f59e0b', marginTop: '20px'}}>
             กำลังประมวลผล {orders.length} รายการ...
           </div>
        )}
      </div>
    </div>
  )
}

export default Kitchen
