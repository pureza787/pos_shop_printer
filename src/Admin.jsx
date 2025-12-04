
import { useState, useEffect, useRef, useMemo } from 'react'
import { db } from './firebase'
import { 
  collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, query, where, serverTimestamp, setDoc, getDoc, writeBatch, getDocs 
} from 'firebase/firestore'
import './Admin.css'

const ADMIN_PIN = '8888'; 
const APP_VERSION = 'v2.8.0 (Fixed)'; 
const MASTER_CATEGORIES = [
  'อาหารจานเดียว', 'ก่วยเตี่ยว', 'กับข้าว', 'ท็อปปิ้ง', 
  'ส้มตำ/ยำ', 'สเต็ก', 'เครื่องดื่ม', 'น้ำปั่น', 'กาแฟ/คาเฟ่', 'ของหวาน','ของทานเล่น',
];

const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function Admin() {
  const [tab, setTab] = useState('tables') 
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([]) 
  const [historyList, setHistoryList] = useState([]) 
  const [dailySalesLog, setDailySalesLog] = useState([]) 
  const [selectedDate, setSelectedDate] = useState(getTodayStr()) 
  const [enabledCategories, setEnabledCategories] = useState(['อาหารจานเดียว', 'เครื่องดื่ม'])
  const [formData, setFormData] = useState({ name: '', price: '', category: 'อาหารจานเดียว', img: '' })
  const [editId, setEditId] = useState(null)
  
  const [isMenuLocked, setIsMenuLocked] = useState(true)
  const [menuPinInput, setMenuPinInput] = useState('')
  const [editingTable, setEditingTable] = useState(null) 
  const [showTablePinModal, setShowTablePinModal] = useState(false)
  const [tablePinInput, setTablePinInput] = useState('')
  const [targetTableToUnlock, setTargetTableToUnlock] = useState(null)

  const prevOrderCountRef = useRef(0);
  const isFirstLoad = useRef(true); 

  useEffect(() => {
    const unsubProducts = onSnapshot(collection(db, "products"), (snap) => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    const unsubOrders = onSnapshot(collection(db, "orders"), (snap) => {
        let newOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        newOrders.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));

        if (isFirstLoad.current) {
            isFirstLoad.current = false;
        } else if (newOrders.length > prevOrderCountRef.current) {
            playSound();
        }
        prevOrderCountRef.current = newOrders.length;
        setOrders(newOrders);
    });

    const qHistory = query(collection(db, "history_orders"), where("dateLabel", "==", selectedDate));
    const unsubHistory = onSnapshot(qHistory, (snap) => {
        let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.finishedAt?.seconds || 0) - (a.finishedAt?.seconds || 0));
        setHistoryList(list);
    });

    const unsubSalesLog = onSnapshot(collection(db, "daily_sales"), (snap) => {
        let logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        logs.sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        setDailySalesLog(logs);
    });

    getDoc(doc(db, "settings", "shopConfig")).then(docSnap => {
      if (docSnap.exists() && docSnap.data().categories) setEnabledCategories(docSnap.data().categories);
    });

    return () => { unsubProducts(); unsubOrders(); unsubSalesLog(); unsubHistory(); };
  }, [selectedDate]) 

  const playSound = () => {
    try { const audio = new Audio('/alert.wav'); audio.play().catch(() => {}); } catch (err) {}
  }

  const handleRequestEditTable = (tableNo) => { setTargetTableToUnlock(tableNo); setTablePinInput(''); setShowTablePinModal(true); }
  const handleTablePinPress = (num) => {
      const nextPin = tablePinInput + num; setTablePinInput(nextPin);
      if (nextPin.length === 4) {
          if (nextPin === ADMIN_PIN) { setTimeout(() => { setEditingTable(targetTableToUnlock); setShowTablePinModal(false); setTablePinInput(''); }, 200); } 
          else { setTimeout(() => { alert('รหัสผิด!'); setTablePinInput(''); }, 200); }
      }
  }
  const handleExitEditMode = () => { setEditingTable(null); }
  
  const consolidateItems = (items) => {
    if (!items) return [];
    const summary = {};
    items.forEach(item => {
      const key = item.name + (item.noodle || '') + (item.options?.join('') || '') + (item.note || '');
      if(!summary[key]) summary[key] = { ...item, qty: item.qty || 1 };
      else summary[key].qty += (item.qty || 1);
    });
    return Object.values(summary);
  };

  const tableGroups = useMemo(() => {
    const grouped = {};
    orders.forEach(o => {
      const t = o.table_no ? String(o.table_no) : 'TakeAway';
      if (!grouped[t]) grouped[t] = [];
      grouped[t].push(o);
    });
    return Object.entries(grouped).sort((a, b) => {
       const numA = parseInt(a[0]);
       const numB = parseInt(b[0]);
       if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
       return a[0].localeCompare(b[0]);
    });
  }, [orders]);

  const getOrdersByTableForPrint = (tableNo) => orders.filter(o => String(o.table_no) === String(tableNo));

  const sendToRawBT = (text) => {
    const sUrl = "rawbt:" + encodeURIComponent(text);
    const iframe = document.createElement("iframe");
    iframe.setAttribute("src", sUrl);
    iframe.style.display = "none";
    document.body.appendChild(iframe);
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }

  const handlePrintBill = (tableNo) => {
    const tableOrders = getOrdersByTableForPrint(tableNo);
    if (!tableOrders.length) return;
    let allItems = [];
    tableOrders.forEach(o => { if(o.items) allItems = [...allItems, ...o.items]; });
    const consolidated = consolidateItems(allItems);
    const totalAmount = consolidated.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const timeStr = new Date().toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'});

    let text = "\x1b\x40\x1b\x61\x01\x1d\x21\x11" + "ใบเสร็จรับเงิน\n"; 
    text += "\x1d\x21\x00" + "ร้านก๋วยเตี่ยวรสเด็ด\n--------------------------------\n";
    text += `โต๊ะ: ${tableNo}  เวลา: ${timeStr}\n--------------------------------\n\x1b\x61\x00`;
    consolidated.forEach(item => {
      text += `${item.name}`;
      if (item.noodle) text += ` (${item.noodle})`; 
      if (item.options?.length > 0) text += ` [${item.options.join(',')}]`;
      if (item.note) text += ` (${item.note})`;
      text += `\n   x${item.qty} @${item.price}     ${(item.price * item.qty).toLocaleString()} .-\n`;
    });
    text += "--------------------------------\n\x1b\x61\x01\x1d\x21\x11" + `รวม: ${totalAmount.toLocaleString()} บาท\n\x1d\x21\x00\n\n\nขอบคุณที่ใช้บริการ\n`;
    sendToRawBT(text);
  };

  const handleClearTable = async (tableNo) => {
    if(!confirm(`ยืนยันเคลียร์โต๊ะ ${tableNo} ?`)) return;
    const tableOrders = getOrdersByTableForPrint(tableNo);
    const batch = writeBatch(db);
    let allTableItems = [];
    tableOrders.forEach(o => { if(o.items) allTableItems = [...allTableItems, ...o.items]; });
    const grandTotal = allTableItems.reduce((sum, item) => sum + (item.price * (item.qty || 1)), 0);

    const historyRef = doc(collection(db, "history_orders"));
    batch.set(historyRef, { 
        table_no: tableNo, items: allTableItems, total_price: grandTotal,
        finishedAt: serverTimestamp(), status: 'done', dateLabel: getTodayStr(),
    });
    tableOrders.forEach(order => { batch.delete(doc(db, "orders", order.id)); });
    try { await batch.commit(); setEditingTable(null); } catch (e) { alert("Error: " + e.message); }
  };

  const handleDeleteItem = async (orderId, itemIndex, itemName) => {
    if(!confirm(`ต้องการลบเมนู "${itemName}" ออกใช่ไหม?`)) return;
    try {
        const orderRef = doc(db, "orders", orderId);
        const orderSnap = await getDoc(orderRef);
        if (orderSnap.exists()) {
            const orderData = orderSnap.data();
            const newItems = [...orderData.items];
            newItems.splice(itemIndex, 1);
            if (newItems.length === 0) await deleteDoc(orderRef);
            else {
                const newTotal = newItems.reduce((sum, i) => sum + (i.price * (i.qty || 1)), 0);
                await updateDoc(orderRef, { items: newItems, total_price: newTotal });
            }
        }
    } catch (e) { alert('ลบไม่สำเร็จ'); }
  }

  const handleVoidTable = async (tableNo) => {
    if(!confirm(`⚠️ อันตราย: ยกเลิกบิลโต๊ะ ${tableNo} ทั้งหมด?\n(ยอดเงินจะหายไป ไม่ถูกบันทึก)`)) return;
    const batch = writeBatch(db);
    getOrdersByTableForPrint(tableNo).forEach(order => batch.delete(doc(db, "orders", order.id)));
    await batch.commit(); setEditingTable(null);
  }

  const handleMoveTable = async (oldTableNo) => {
      const newTableNo = prompt(`🌧️ ย้ายจากโต๊ะ ${oldTableNo} ไปโต๊ะไหนครับ?`);
      if (!newTableNo || newTableNo === oldTableNo) return; 
      const batch = writeBatch(db);
      getOrdersByTableForPrint(oldTableNo).forEach(order => batch.update(doc(db, "orders", order.id), { table_no: newTableNo }));
      try { await batch.commit(); } catch (error) { alert("ย้ายโต๊ะไม่สำเร็จ"); }
  }

  const handleCloseDay = async () => {
    if (!confirm(`ยืนยันปิดยอดขายวันที่ ${selectedDate}?`)) return;
    try {
        const q = query(collection(db, "history_orders"), where("dateLabel", "==", selectedDate));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return alert("ไม่พบรายการบิลในระบบ");
        const realOrders = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const totalSales = realOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);
        const totalOrders = realOrders.length; 
        const itemCounts = {};
        realOrders.forEach(o => o.items.forEach(i => itemCounts[i.name] = (itemCounts[i.name] || 0) + (i.qty || 1)));
        const topMenu = Object.entries(itemCounts).sort(([, a], [, b]) => b - a).slice(0, 3).map(([n, c]) => `${n}(${c})`).join(', ');
        const batch = writeBatch(db);
        batch.set(doc(collection(db, "daily_sales")), {
            timestamp: serverTimestamp(), date_string: new Date(selectedDate).toLocaleDateString('th-TH'),
            total_sales: totalSales, total_orders: totalOrders, top_menu: topMenu
        });
        snapshot.docs.forEach((docSnap) => batch.delete(docSnap.ref));
        await batch.commit(); alert("✅ ปิดยอดวันนี้เรียบร้อย!"); setTab('dashboard'); 
    } catch (error) { alert("เกิดข้อผิดพลาด: " + error.message); }
  }

  const deleteSalesLog = async (id) => { if(confirm("ลบยอดขายนี้?")) await deleteDoc(doc(db, "daily_sales", id)); }
  const toggleCategory = async (cat) => { const newCats = enabledCategories.includes(cat) ? enabledCategories.filter(c => c !== cat) : [...enabledCategories, cat]; setEnabledCategories(newCats); await setDoc(doc(db, "settings", "shopConfig"), { categories: newCats }, { merge: true }); }
  const handleSave = async (e) => { e.preventDefault(); const payload = { ...formData, price: Number(formData.price), available: true }; if (editId) { await updateDoc(doc(db, "products", editId), payload); setEditId(null); } else { await addDoc(collection(db, "products"), payload); } setFormData({ ...formData, name: '', price: '', category: 'อาหารจานเดียว', img: '' }); }
  const startEdit = (item) => { setFormData({ name: item.name, price: item.price, category: item.category, img: item.img || '' }); setEditId(item.id); setTab('menu'); window.scrollTo(0, 0); }
  const toggleAvailable = async (item) => await updateDoc(doc(db, "products", item.id), { available: !item.available });
  const handleDelete = async (id) => { if (confirm('ยืนยันลบเมนู?')) await deleteDoc(doc(db, "products", id)); }
  
  const handleMenuPinPress = (num) => {
    const nextPin = menuPinInput + num; setMenuPinInput(nextPin);
    if (nextPin.length === 4) {
      if (nextPin === ADMIN_PIN) { setTimeout(() => { setIsMenuLocked(false); setMenuPinInput(''); }, 200); } 
      else { setTimeout(() => { alert('รหัสผิด'); setMenuPinInput(''); }, 200); }
    }
  }

  const currentStats = { total: historyList.reduce((sum, o) => sum + (o.total_price || 0), 0), count: historyList.length };

  return (
    <div className="admin-container">
      {showTablePinModal && (
          <div className="pin-overlay">
              <div className="admin-card pin-card">
                <h3 style={{color:'var(--warning)', marginBottom:'10px'}}>🔓 รหัสแก้ไขโต๊ะ {targetTableToUnlock}</h3>
                <div className="pin-dots">{'•'.repeat(tablePinInput.length)}</div>
                <div className="numpad">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0].map(n => (
                    <button key={n} onClick={() => n === 'C' ? setTablePinInput('') : handleTablePinPress(n.toString())} className={`num-btn ${n === 'C' ? 'btn-clear' : ''}`}>{n}</button>
                  ))}
                </div>
                <button onClick={() => setShowTablePinModal(false)} className="btn-secondary btn-full">ยกเลิก</button>
              </div>
          </div>
      )}
      <div className="admin-sidebar">
        <div className="sidebar-title">⚡ POS System</div>
        <div onClick={() => setTab('tables')} className={`menu-item ${tab === 'tables' ? 'active' : ''}`}>🍽️ จัดการโต๊ะ</div>
        <div onClick={() => setTab('dashboard')} className={`menu-item ${tab === 'dashboard' ? 'active' : ''}`}>📊 ยอดขาย</div>
        <div onClick={() => setTab('history')} className={`menu-item ${tab === 'history' ? 'active' : ''}`}>📜 ประวัติบิล</div>
        <div onClick={() => { setTab('menu'); setIsMenuLocked(true); }} className={`menu-item ${tab === 'menu' ? 'active' : ''}`}>🍜 เมนู 🔒</div>
        <div className="version-tag">{APP_VERSION}</div>
      </div>
      <div className="admin-content">
        <h1 className="page-title">
          {tab === 'tables' ? '🍽️ สถานะโต๊ะล่าสุด' : tab === 'history' ? '📜 ประวัติบิลย้อนหลัง' : tab === 'menu' ? '⚙️ จัดการร้าน' : '📊 สรุปยอดขาย'}
        </h1>
        {tab === 'tables' && (
          <div className="grid-tables">
            {tableGroups.length === 0 ? (
              <div className="empty-state" style={{color:'#666', gridColumn:'1/-1', textAlign:'center', marginTop:'50px'}}>
                  <p style={{fontSize: '3rem'}}>😴</p>
                  <p>ยังไม่มีรายการสั่งอาหารเข้ามา</p>
              </div>
            ) : (
                tableGroups.map(([tableNo, tableOrders]) => {
                   const total = tableOrders.reduce((sum, order) => sum + (order.items?.reduce((s, i) => s + (Number(i.price) * (i.qty||1)), 0) || 0), 0);
                   const isEditing = editingTable === tableNo;
                   return (
                    <div key={tableNo} className={`admin-card table-card ${isEditing ? 'editing' : ''}`}>
                      <div className="table-header">
                        <span className="table-title" style={{color: isEditing ? 'var(--warning)' : 'white'}}>
                            {isEditing ? `🔓 แก้ไขโต๊ะ ${tableNo}` : `โต๊ะ ${tableNo}`}
                        </span>
                        {!isEditing && <button onClick={() => handleMoveTable(tableNo)} className="btn-secondary" style={{padding:'4px 8px', fontSize:'0.8rem'}}>⇄ ย้าย</button>}
                      </div>
                      <div className="order-scroll-list">
                        {tableOrders.map(o => (
                          o.items && o.items.map((item, idx) => (
                             <div key={`${o.id}-${idx}`} className="order-item-row">
                                <div>
                                  <span>{item.name}</span>
                                  {item.qty > 1 && <span className="item-qty">x{item.qty}</span>}
                                  {item.note && <div style={{fontSize:'0.8rem', color:'orange'}}>📝 {item.note}</div>}
                                  {(item.noodle || (item.options && item.options.length > 0)) && 
                                    <span className="item-opt"> {item.noodle} {item.options?.join(',')}</span>
                                  }
                                </div>
                                <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                                  <span>{Number(item.price) * (item.qty||1)}</span>
                                  {isEditing && (
                                      <button onClick={() => handleDeleteItem(o.id, idx, item.name)} className="btn-sm-del">ลบ</button>
                                  )}
                                </div>
                             </div>
                          ))
                        ))}
                      </div>
                      <div className={`total-display ${isEditing ? 'editing' : ''}`}>฿{total.toLocaleString()}</div>
                      <div className="btn-wrapper">
                        {!isEditing ? (
                            <>
                                <div className="btn-group">
                                    <button onClick={() => handlePrintBill(tableNo)} className="btn-primary">🖨️ พิมพ์</button>
                                    <button onClick={() => handleClearTable(tableNo)} className="btn-success">เคลียร์โต๊ะ</button>
                                </div>
                                <button onClick={() => handleRequestEditTable(tableNo)} className="btn-secondary btn-full">🔒 แก้ไข / ยกเลิก</button>
                            </>
                        ) : (
                            <div className="btn-group">
                                <button onClick={() => handleVoidTable(tableNo)} className="btn-danger">🚫 Void บิล</button>
                                <button onClick={handleExitEditMode} className="btn-warning">↩️ เสร็จสิ้น</button>
                            </div>
                        )}
                      </div>
                    </div>
                   )
                })
            )}
          </div>
        )}
        {tab === 'history' && (
           <div className="vertical-stack">
             <div className="admin-card history-controls">
                <div className="date-picker-group">
                    <span>📅 เลือกวันที่:</span>
                    <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="date-input" />
                </div>
                <div style={{display:'flex', gap:'20px', alignItems:'center'}}>
                   <div style={{textAlign:'right'}}>
                      <div style={{fontSize:'0.9rem', color:'#aaa'}}>ยอดรวมวันนี้</div>
                      <div style={{fontSize:'1.4rem', fontWeight:'bold', color:'var(--accent)'}}>฿{currentStats.total.toLocaleString()}</div>
                   </div>
                   <button onClick={handleCloseDay} className="btn-success">✅ ปิดยอดวัน</button>
                </div>
             </div>
             <div className="grid-tables">
               {historyList.length === 0 ? <div style={{gridColumn:'1/-1', textAlign:'center', padding:'40px'}}>❌ ไม่พบบิลของวันที่ {selectedDate}</div> : historyList.map((bill) => (
                 <div key={bill.id} className="admin-card history-card">
                    <div className="history-header">
                       <div>
                         <span style={{fontSize:'1.2rem', fontWeight:'bold'}}>โต๊ะ {bill.table_no}</span>
                         <span className="badge-time" style={{marginLeft:'10px'}}>{bill.finishedAt?.seconds ? new Date(bill.finishedAt.seconds * 1000).toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'}) : '-'} น.</span>
                       </div>
                       <div style={{color:'var(--accent)', fontWeight:'bold'}}>฿{bill.total_price.toLocaleString()}</div>
                    </div>
                    <div className="order-scroll-list" style={{height:'120px', background:'transparent'}}>
                       {consolidateItems(bill.items).map((item, idx) => (
                           <div key={idx} className="order-item-row">
                                <span>{item.name} {item.qty > 1 && <span className="item-qty">x{item.qty}</span>}</span>
                                <span style={{color:'#aaa'}}>{(item.price * item.qty).toLocaleString()}</span>
                           </div>
                       ))}
                    </div>
                 </div>
               ))}
             </div>
           </div>
        )}
        {tab === 'menu' && (
          isMenuLocked ? (
            <div className="pin-overlay" style={{position:'absolute'}}>
              <div className="admin-card pin-card">
                <h2>🔒 ใส่รหัสร้านค้า</h2>
                <div className="pin-dots">{'•'.repeat(menuPinInput.length)}</div>
                <div className="numpad">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0].map(n => (
                    <button key={n} onClick={() => n === 'C' ? setMenuPinInput('') : handleMenuPinPress(n.toString())} className={`num-btn ${n === 'C' ? 'btn-clear' : ''}`}>{n}</button>
                  ))}
                </div>
                <button onClick={() => setTab('tables')} className="btn-secondary btn-full">ยกเลิก</button>
              </div>
            </div>
          ) : (
            <div className="menu-layout-2col">
              <div className="vertical-stack">
                <div className="admin-card">
                  <h3 style={{marginTop:0}}>⚙️ หมวดหมู่</h3>
                  <div className="cat-tags">
                    {MASTER_CATEGORIES.map(cat => (
                      <label key={cat} className={`cat-chip ${enabledCategories.includes(cat) ? 'active' : ''}`}>
                        <input type="checkbox" checked={enabledCategories.includes(cat)} onChange={() => toggleCategory(cat)} />
                        {cat}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="admin-card" style={{position:'sticky', top:'20px'}}>
                  <h3 style={{marginTop:0}}>{editId ? '✏️ แก้ไขเมนู' : '➕ เพิ่มเมนูใหม่'}</h3>
                  <form onSubmit={handleSave} className="form-vertical">
                    <input className="input-field" placeholder="ชื่อเมนู" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                    <input className="input-field" type="number" placeholder="ราคา" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} required />
                    <select className="input-field" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                      {enabledCategories.map(c => <option key={c} value={c}>{c}</option>)}
                      {!enabledCategories.includes(formData.category) && <option value={formData.category}>{formData.category}</option>}
                    </select>
                    <input className="input-field" placeholder="URL รูปภาพ (ถ้ามี)" value={formData.img} onChange={e => setFormData({ ...formData, img: e.target.value })} />
                    <button type="submit" className={`btn-primary btn-full ${editId ? 'btn-warning' : ''}`}>{editId ? 'บันทึกแก้ไข' : 'เพิ่มเมนู'}</button>
                    {editId && <button onClick={() => {setEditId(null); setFormData({name:'', price:'', category:'อาหารจานเดียว', img:''})}} className="btn-secondary btn-full">ยกเลิก</button>}
                  </form>
                </div>
              </div>
              <div className="admin-card" style={{height:'fit-content'}}>
                {products.map(p => (
                  <div key={p.id} className={`product-row ${!p.available ? 'disabled' : ''}`}>
                    <div className="product-info">
                      <img src={p.img || 'https://via.placeholder.com/60?text=No+Img'} className="product-img" />
                      <div className="product-details">
                        <h4>{p.name} {!p.available && <span className="tag-out">หมด</span>}</h4>
                        <p>{p.category} | <span style={{color:'var(--accent)'}}>{p.price}.-</span></p>
                      </div>
                    </div>
                    <div className="action-btns">
                      <button onClick={() => toggleAvailable(p)} className={`btn-icon btn-toggle ${!p.available ? 'sold-out' : ''}`}>
                        {p.available ? ' เปิดขาย' : ' ของหมด'}
                      </button>
                      <button onClick={() => startEdit(p)} className="btn-icon btn-edit"> แก้ไข</button>
                      <button onClick={() => handleDelete(p.id)} className="btn-icon btn-del"> ลบ</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}
        {tab === 'dashboard' && (
            <div className="admin-card">
              <h3>📜 บันทึกยอดขายรายวัน (Logs)</h3>
              <table className="dashboard-table">
                <thead><tr><th>วันที่</th><th>ยอดขาย</th><th>จำนวนบิล</th><th>เมนูขายดี</th><th>Actions</th></tr></thead>
                <tbody>
                  {dailySalesLog.map((log) => (
                    <tr key={log.id}>
                      <td>{log.date_string}</td>
                      <td style={{color:'var(--accent)', fontWeight:'bold'}}>฿{log.total_sales.toLocaleString()}</td>
                      <td>{log.total_orders}</td>
                      <td style={{fontSize:'0.85rem', color:'#aaa'}}>{log.top_menu}</td>
                      <td>
                          <button onClick={() => deleteSalesLog(log.id)} className="btn-sm-del">ลบ</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        )}
      </div>
    </div>
  )
}

export default Admin
