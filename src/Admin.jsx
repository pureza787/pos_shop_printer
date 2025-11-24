import { useState, useEffect } from 'react'
import { db } from './firebase'
import { 
  collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, query, orderBy, writeBatch, serverTimestamp 
} from 'firebase/firestore'
import './Admin.css'

// 🔑 รหัสผ่าน (แก้ไขตรงนี้)
const ADMIN_PIN = '8888';

function Admin() {
  const [tab, setTab] = useState('kitchen')
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [dailySales, setDailySales] = useState([]) // 🆕 เก็บประวัติยอดขายรายวัน
  const [formData, setFormData] = useState({ name: '', price: '', category: 'อาหารจานเดียว', img: '' })
  const [editId, setEditId] = useState(null)
  const [isMenuLocked, setIsMenuLocked] = useState(true)
  const [pinInput, setPinInput] = useState('')

  // ดึงข้อมูลสินค้า
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "products"), (snapshot) => setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    return () => unsubscribe();
  }, [])

  // ดึงข้อมูลออเดอร์ปัจจุบัน
  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    return () => unsubscribe();
  }, [])

  // 🆕 ดึงประวัติยอดขายรายวัน (เรียงจากล่าสุด)
  useEffect(() => {
    const q = query(collection(db, "daily_sales"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => setDailySales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    return () => unsubscribe();
  }, [])

  const markAsDone = async (orderId) => { if (confirm('ยืนยันว่าทำเสร็จ/เสิร์ฟแล้ว?')) await updateDoc(doc(db, "orders", orderId), { status: "served" }); }
  const activeOrders = orders.filter(o => o.status !== 'served');

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.price) return alert('กรอกข้อมูลให้ครบครับ');
    const payload = { ...formData, price: Number(formData.price), available: true };
    if (editId) { await updateDoc(doc(db, "products", editId), payload); setEditId(null); }
    else { await addDoc(collection(db, "products"), payload); }
    setFormData({ name: '', price: '', category: 'อาหารจานเดียว', img: '' }); alert('✅ บันทึกเรียบร้อย');
  }

  const startEdit = (item) => { setFormData({ name: item.name, price: item.price, category: item.category, img: item.img || '' }); setEditId(item.id); setTab('menu'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  const toggleAvailable = async (item) => await updateDoc(doc(db, "products", item.id), { available: item.available === false ? true : false });
  const handleDelete = async (id) => { if (confirm('ลบเมนูนี้จริงหรือไม่?')) await deleteDoc(doc(db, "products", id)); }

  const calculateStats = () => {
    const totalSales = orders.reduce((sum, order) => sum + (order.total_price || 0), 0);
    const itemCounts = {};
    orders.forEach(order => order.items.forEach(item => itemCounts[item.name] = (itemCounts[item.name] || 0) + 1));
    const bestSellers = Object.entries(itemCounts).sort(([, a], [, b]) => b - a).slice(0, 5);
    return { totalSales, totalOrders: orders.length, bestSellers };
  }
  const stats = calculateStats();

  // 🆕 ฟังก์ชันปิดยอดรายวัน (Reset Bill)
  const handleCloseDay = async () => {
    if (orders.length === 0) return alert("ยังไม่มีออเดอร์ให้ปิดยอดครับ");
    if (!confirm(`⚠️ ยืนยันปิดยอดขายของวันนี้?\n\nยอดรวม: ฿${stats.totalSales.toLocaleString()}\nจำนวน: ${stats.totalOrders} บิล\n\n(ระบบจะบันทึกประวัติ และล้างออเดอร์ปัจจุบันออกทั้งหมด)`)) return;

    try {
      // 1. บันทึกลง Collection "daily_sales"
      await addDoc(collection(db, "daily_sales"), {
        timestamp: serverTimestamp(),
        date_string: new Date().toLocaleDateString('th-TH'), // เก็บเป็นข้อความวันที่
        total_sales: stats.totalSales,
        total_orders: stats.totalOrders,
        top_menu: stats.bestSellers.map(i => `${i[0]} (${i[1]})`).join(', ') // เก็บเมนูขายดีไว้ดูเล่น
      });

      // 2. ลบออเดอร์ทั้งหมดใน "orders" (ใช้ Batch Write เพื่อความเร็ว)
      const batch = writeBatch(db);
      orders.forEach(order => {
        const orderRef = doc(db, "orders", order.id);
        batch.delete(orderRef);
      });
      await batch.commit();

      alert("✅ ปิดยอดเรียบร้อย! เริ่มวันใหม่ได้เลยครับ");
    } catch (error) {
      console.error(error);
      alert("เกิดข้อผิดพลาด: " + error.message);
    }
  }

  // 🆕 ฟังก์ชันลบประวัติ
  const handleDeleteHistory = async (id) => {
    if(confirm('ต้องการลบประวัติยอดขายรายการนี้?')) {
      await deleteDoc(doc(db, "daily_sales", id));
    }
  }

  const handlePinPress = (num) => {
    if (pinInput.length < 4) {
      const newPin = pinInput + num;
      setPinInput(newPin);
      if (newPin.length === 4) {
        if (newPin === ADMIN_PIN) {
          setTimeout(() => { setIsMenuLocked(false); setPinInput(''); }, 200);
        } else {
          setTimeout(() => { alert('❌ รหัสผิดครับ!'); setPinInput(''); }, 200);
        }
      }
    }
  }

  const changeTab = (newTab) => {
    setTab(newTab);
    if (newTab !== 'menu') { setIsMenuLocked(true); setPinInput(''); }
  }

  return (
    <div className="admin-container">
      {/* Sidebar */}
      <div className="admin-sidebar">
        <h2 className="sidebar-title">⚡ POS System</h2>
        <div onClick={() => changeTab('kitchen')} className={`menu-item ${tab === 'kitchen' ? 'active' : ''}`}>🍳 ครัว ({activeOrders.length})</div>
        <div onClick={() => changeTab('menu')} className={`menu-item ${tab === 'menu' ? 'active' : ''}`}>🍔 จัดการเมนู 🔒</div>
        <div onClick={() => changeTab('dashboard')} className={`menu-item ${tab === 'dashboard' ? 'active' : ''}`}>📊 ยอดขาย</div>
      </div>

      {/* Content Area */}
      <div className="admin-content">
        <h1 className="page-title">
          {tab === 'kitchen' ? '👨‍🍳 รายการออเดอร์เข้า' : tab === 'menu' ? '🍔 จัดการเมนูอาหาร' : '📊 ภาพรวมยอดขาย'}
        </h1>

        {/* Kitchen Tab */}
        {tab === 'kitchen' && (
          <div className="kitchen-grid">
            {activeOrders.length === 0 ? (
              <div className="admin-card" style={{ textAlign: 'center', gridColumn: '1 / -1' }}>
                <h2 style={{ color: 'var(--accent)' }}>✅ ครัวว่างครับ!</h2>
                <p style={{ color: 'var(--text-dark)' }}>ยังไม่มีออเดอร์ใหม่เข้ามา</p>
              </div>
            ) : activeOrders.map((order) => (
              <div key={order.id} className="admin-card" style={{ borderLeft: '5px solid var(--accent)' }}>
                <div className="card-header">
                  <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--accent)' }}>โต๊ะ {order.table_no}</span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 'bold' }}>
                      {order.timestamp ? new Date(order.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-dark)' }}>เวลาสั่ง</div>
                  </div>
                </div>
                <ul style={{ paddingLeft: '20px', marginBottom: '20px' }}>
                  {order.items.map((item, index) => (
                    <li key={index} style={{ marginBottom: '5px', fontSize: '18px' }}>
                      {item.name} <span style={{ fontSize: '14px', color: 'var(--text-dark)' }}>({item.category})</span>
                      {item.note && <div style={{ color: '#ff3d00', fontSize: '16px', fontWeight: 'bold' }}>⚠️ หมายเหตุ: {item.note}</div>}
                    </li>
                  ))}
                </ul>
                <button onClick={() => markAsDone(order.id)} className="btn-primary" style={{ width: '100%' }}>✅ ทำเสร็จแล้ว / เสิร์ฟ</button>
              </div>
            ))}
          </div>
        )}

        {/* Menu Tab */}
        {tab === 'menu' && (
          isMenuLocked ? (
            <div className="pin-container">
              <div className="admin-card" style={{ textAlign: 'center', width: '400px' }}>
                <h2 style={{ marginTop: 0 }}>🔒 ใส่รหัสผ่าน</h2>
                <p style={{ color: 'var(--text-dark)' }}>เพื่อเข้าแก้ไขเมนู</p>
                <div className="pin-display">{'•'.repeat(pinInput.length)}</div>
                <div className="numpad-grid">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button key={num} onClick={() => handlePinPress(num.toString())} className="num-btn">{num}</button>
                  ))}
                  <button onClick={() => setPinInput('')} className="num-btn" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>C</button>
                  <button onClick={() => handlePinPress('0')} className="num-btn">0</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="menu-layout">
              <div className="admin-card" style={{ position: 'sticky', top: '20px' }}>
                <h3 style={{ marginTop: 0, color: 'var(--accent)' }}>{editId ? '✏️ แก้ไขเมนู' : '➕ เพิ่มเมนูใหม่'}</h3>
                <form onSubmit={handleSave}>
                  <input className="form-input" placeholder="ชื่อเมนู" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                  <input className="form-input" type="number" placeholder="ราคา" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} required />
                  <select className="form-input" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                    <option>อาหารจานเดียว</option><option>กับข้าว</option><option>เครื่องดื่ม</option><option>ของหวาน</option>
                  </select>
                  <input className="form-input" placeholder="URL รูปภาพ" value={formData.img} onChange={e => setFormData({ ...formData, img: e.target.value })} />
                  <button type="submit" className="btn-primary" style={{ width: '100%', backgroundColor: editId ? 'var(--warning)' : 'var(--accent)', color: 'var(--bg-main)' }}>
                    {editId ? 'บันทึกแก้ไข' : 'เพิ่มเมนู'}
                  </button>
                </form>
              </div>
              <div style={{ display: 'grid', gap: '15px' }}>
                {products.map(p => (
                  <div key={p.id} className="admin-card" style={{ display: 'flex', justifyContent: 'space-between', opacity: p.available === false ? 0.5 : 1 }}>
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                      <img src={p.img || 'https://via.placeholder.com/60'} alt={p.name} style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px', backgroundColor: '#333' }} />
                      <div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{p.name} {p.available === false && <span style={{ color: 'var(--danger)', fontSize: '14px' }}>(ของหมด)</span>}</div>
                        <div style={{ color: 'var(--text-dark)' }}>{p.category} | <span style={{ color: 'var(--accent)' }}>{p.price}.-</span></div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <button onClick={() => toggleAvailable(p)} className="btn-secondary" style={{ borderColor: p.available === false ? 'var(--text-dark)' : 'var(--accent)', color: p.available === false ? 'var(--text-dark)' : 'var(--accent)' }}>{p.available === false ? 'ปิดอยู่' : 'เปิดขาย'}</button>
                      <button onClick={() => startEdit(p)} className="btn-secondary">✏️ แก้ไข</button>
                      <button onClick={() => handleDelete(p.id)} className="btn-secondary" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>🗑️ ลบ</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}

        {/* Dashboard Tab */}
        {tab === 'dashboard' && (
          <div>
            {/* 🆕 ปุ่มปิดยอดรายวัน */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
              <button onClick={handleCloseDay} className="btn-primary" style={{ backgroundColor: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                🌙 ปิดยอดขายวันนี้ (Reset Bill)
              </button>
            </div>

            <div className="dashboard-grid">
              <div className="admin-card" style={{ background: 'linear-gradient(135deg, rgba(0,230,118,0.2), var(--bg-panel))' }}>
                <h3 style={{ margin: 0, color: 'var(--text-dark)' }}>ยอดขายวันนี้ (Current)</h3>
                <div style={{ fontSize: '48px', fontWeight: 'bold', color: 'var(--accent)' }}>฿{stats.totalSales.toLocaleString()}</div>
              </div>
              <div className="admin-card">
                <h3 style={{ margin: 0, color: 'var(--text-dark)' }}>จำนวนออเดอร์</h3>
                <div style={{ fontSize: '48px', fontWeight: 'bold' }}>{stats.totalOrders} <span style={{ fontSize: '20px', color: 'var(--text-dark)' }}>บิล</span></div>
              </div>
            </div>
            
            <div className="admin-card" style={{marginBottom: '30px'}}>
              <h2 style={{ marginTop: 0, color: 'var(--accent)' }}>🏆  เมนูขายดี (วันนี้)</h2>
              {stats.bestSellers.map(([name, count], index) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 0', borderBottom: '1px solid var(--bg-main)', fontSize: '18px' }}>
                  <div>
                    <span style={{ fontWeight: 'bold', color: 'var(--bg-main)', backgroundColor: 'var(--accent)', width: '30px', height: '30px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginRight: '15px' }}>{index + 1}</span> {name}
                  </div>
                  <div style={{ fontWeight: 'bold', color: 'var(--accent)' }}>{count} จาน</div>
                </div>
              ))}
              {stats.bestSellers.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dark)' }}>ยังไม่มีข้อมูลการขาย</div>}
            </div>

            {/* 🆕 ตารางประวัติยอดขาย */}
            <div className="admin-card">
              <h2 style={{ marginTop: 0, color: 'var(--text-light)', borderBottom: '1px solid var(--bg-main)', paddingBottom: '15px' }}>📜 ประวัติยอดขายรายวัน (History)</h2>
              <div style={{ overflowX: 'auto' }}>
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>วันที่</th>
                      <th>ยอดขายรวม</th>
                      <th>จำนวนบิล</th>
                      <th>เมนูยอดฮิต</th>
                      <th>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailySales.map((log) => (
                      <tr key={log.id}>
                        <td>{log.date_string} <br/> <span style={{fontSize:'12px', color:'var(--text-dark)'}}>{log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000).toLocaleTimeString('th-TH') : ''}</span></td>
                        <td style={{color: 'var(--accent)', fontWeight: 'bold'}}>฿{log.total_sales.toLocaleString()}</td>
                        <td>{log.total_orders}</td>
                        <td style={{maxWidth: '200px', fontSize: '14px', color: 'var(--text-dark)'}}>{log.top_menu}</td>
                        <td>
                          <button onClick={() => handleDeleteHistory(log.id)} className="btn-secondary" style={{borderColor: 'var(--danger)', color: 'var(--danger)', fontSize: '12px', padding: '5px 10px'}}>ลบ</button>
                        </td>
                      </tr>
                    ))}
                    {dailySales.length === 0 && <tr><td colSpan="5" style={{textAlign: 'center', padding: '20px'}}>ยังไม่มีประวัติ</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Admin