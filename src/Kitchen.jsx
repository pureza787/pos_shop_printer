import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore'
import './Kitchen.css' // ✅ เชื่อมไฟล์ CSS ตรงนี้

function Kitchen() {
  const [orders, setOrders] = useState([])
  const [tab, setTab] = useState('active') // active = กำลังทำ, history = ประวัติ

  // ดึงข้อมูลออเดอร์แบบ Real-time
  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orderList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setOrders(orderList);
    });
    return () => unsubscribe();
  }, [])

  const markAsDone = async (orderId) => {
    if(confirm('ยืนยันว่าทำเสร็จแล้ว?')) {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, { status: "served" });
    }
  }

  // แยกออเดอร์ที่เสร็จแล้ว กับ ยังไม่เสร็จ
  const activeOrders = orders.filter(o => o.status !== 'served');
  const historyOrders = orders.filter(o => o.status === 'served');

  const displayOrders = tab === 'active' ? activeOrders : historyOrders;

  return (
    <div className="kitchen-container">
      
      <div className="kitchen-header">
        <h1 className="kitchen-title">👨‍🍳 ครัว & ประวัติ ({displayOrders.length})</h1>
        <div className="tab-group">
          <button 
            onClick={() => setTab('active')} 
            className={`tab-btn btn-active ${tab === 'active' ? 'selected' : ''}`}
          >
            🔥 กำลังทำ
          </button>
          <button 
            onClick={() => setTab('history')} 
            className={`tab-btn btn-history ${tab === 'history' ? 'selected' : ''}`}
          >
            📜 ประวัติย้อนหลัง
          </button>
        </div>
      </div>

      <div className="order-grid">
        {displayOrders.map((order) => (
          <div 
            key={order.id} 
            /* ✅ สลับ Class ตามสถานะ (status-served หรือ status-active) */
            className={`order-card ${order.status === 'served' ? 'status-served' : 'status-active'}`}
          >
            <div className="card-header">
              <span className="table-no">โต๊ะ: {order.table_no}</span>
              <div className="timestamp-box">
                <div>{order.timestamp ? new Date(order.timestamp.seconds * 1000).toLocaleDateString('th-TH') : ''}</div>
                <div className="time-text">{order.timestamp ? new Date(order.timestamp.seconds * 1000).toLocaleTimeString('th-TH') : ''}</div>
              </div>
            </div>
            
            <ul className="order-items">
              {order.items.map((item, index) => (
                <li key={index} className="order-item">
                  {item.name} <span className="item-cat">({item.category})</span>
                  {item.note && <div className="item-note">⚠️ หมายเหตุ: {item.note}</div>}
                </li>
              ))}
            </ul>
            
            <div className="card-footer">
              <span className="total-price">รวม {order.total_price} บ.</span>
              {order.status !== 'served' ? (
                <button onClick={() => markAsDone(order.id)} className="btn-done">
                  ✅ เสร็จแล้ว
                </button>
              ) : (
                <span className="text-served">✅ เสิร์ฟแล้ว</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Kitchen