import { useState, useEffect } from 'react'
import { db } from './firebase'
import { 
  collection, addDoc, serverTimestamp, query, where, onSnapshot, 
  deleteDoc, doc, orderBy 
} from 'firebase/firestore'
import './App.css' // ✅ เชื่อมไฟล์ CSS ตรงนี้

function App() {
  const [cart, setCart] = useState([])
  const [myOrders, setMyOrders] = useState([])
  const [isOrdering, setIsOrdering] = useState(false)
  const [showCartDetails, setShowCartDetails] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('ทั้งหมด')
  const [menuItems, setMenuItems] = useState([])

  const params = new URLSearchParams(window.location.search);
  const tableNo = params.get('table') || '1';

  // ดึงเมนู
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "products"), (snapshot) => {
      setMenuItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [])

  // ดึงประวัติ
  useEffect(() => {
    const q = query(collection(db, "orders"), where("table_no", "==", tableNo), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMyOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [tableNo])

  const CATEGORIES = ['ทั้งหมด', ...new Set(menuItems.map(item => item.category || 'อื่นๆ'))]

  const addToCart = (item) => {
    setCart([...cart, { ...item, uniqueId: Date.now() + Math.random(), note: '' }])
  }

  const removeFromCart = (uniqueId) => setCart(cart.filter(item => item.uniqueId !== uniqueId))

  const updateNote = (uniqueId, text) => {
    setCart(cart.map(item => item.uniqueId === uniqueId ? { ...item, note: text } : item))
  }

  const handleConfirmOrder = async () => {
    if (cart.length === 0) return;
    setIsOrdering(true);
    try {
      await addDoc(collection(db, "orders"), {
        table_no: tableNo,
        items: cart,
        total_price: cart.reduce((sum, item) => sum + item.price, 0),
        status: "kitchen",
        timestamp: serverTimestamp()
      });
      setCart([]);
      setShowCartDetails(false);
      alert("✅ ส่งออเดอร์เรียบร้อย!");
    } catch (error) {
      alert("❌ ผิดพลาด: " + error.message);
    } finally {
      setIsOrdering(false);
    }
  }

  const handleCancelOrder = async (orderId) => {
    if (confirm("ยืนยันยกเลิกออเดอร์นี้?")) {
      try { await deleteDoc(doc(db, "orders", orderId)); } 
      catch (error) { alert("ลบไม่ได้: " + error.message); }
    }
  }

  const filteredItems = menuItems.filter(item => {
    const matchCategory = selectedCategory === 'ทั้งหมด' || item.category === selectedCategory;
    const isAvailable = item.available !== false;
    return matchCategory && isAvailable;
  });

  const cartTotal = cart.reduce((sum, item) => sum + item.price, 0);

  return (
    <div className="app-container">
      
      <header className="app-header">
        <div className="header-top">
          <div className="logo-group">
             {/* ✅ ใส่รูปโลโก้ที่นี่ */}
             <img 
               src="https://chonburiartmediagroup.com/wp-content/uploads/2021/02/LOGO26-960x673.jpg" 
               alt="Logo"
               className="logo-img"
             />
             <h1 className="app-title">ร้านอร่อยสั่งได้</h1>
          </div>
          <span className="table-badge">โต๊ะ {tableNo}</span>
        </div>

        <div className="category-scroll">
          {CATEGORIES.map(cat => (
            <button 
              key={cat} 
              onClick={() => setSelectedCategory(cat)}
              className={`category-btn ${selectedCategory === cat ? 'active' : ''}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      <div className="content-area">
        {menuItems.length === 0 ? (
          <div className="loading-text"><p>⏳ กำลังโหลดเมนู...</p></div>
        ) : (
          <div className="menu-grid">
            {filteredItems.map((item) => (
              <div key={item.id} className="menu-card">
                <img src={item.img || 'https://via.placeholder.com/150'} className="menu-img" alt={item.name} />
                <div className="menu-content">
                  <div className="menu-name">{item.name}</div>
                  <div className="menu-category">{item.category}</div>
                  <div className="menu-footer">
                    <span className="price-tag">{item.price}.-</span>
                    <button onClick={() => addToCart(item)} className="add-btn">+</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {myOrders.length > 0 && (
        <div className="history-container">
          <h3 className="section-title">📋 ประวัติการสั่ง</h3>
          <div className="history-list">
            {myOrders.map((order) => (
              <div 
                key={order.id} 
                className={`history-card ${order.status === 'served' ? 'served' : 'kitchen'}`}
              >
                <div className="history-header">
                  <span>เวลา: {order.timestamp ? new Date(order.timestamp.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}</span>
                  <span className={order.status === 'served' ? 'status-served' : 'status-kitchen'}>
                    {order.status === 'served' ? '✅ เสิร์ฟแล้ว' : '👨‍🍳 กำลังทำ'}
                  </span>
                </div>
                {order.items.map((item, idx) => (
                  <div key={idx} className="history-item-name">
                    - {item.name}
                    {item.note && <span className="history-item-note"> ({item.note})</span>}
                  </div>
                ))}
                {order.status === 'kitchen' && (
                  <button onClick={() => handleCancelOrder(order.id)} className="cancel-btn">ยกเลิก</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {cart.length > 0 && (
        <>
          <div className="cart-bar">
            <div onClick={() => setShowCartDetails(!showCartDetails)} className="cart-info">
              <div className="cart-count">{cart.length} รายการ</div>
              <div className="cart-subtext">ดูรายละเอียด 🔼</div>
            </div>
            <button onClick={handleConfirmOrder} disabled={isOrdering} className="order-btn">
              {isOrdering ? 'ส่ง...' : `สั่งเลย ${cartTotal} ฿`}
            </button>
          </div>
          
          {showCartDetails && (
            <div className="cart-modal-overlay" onClick={() => setShowCartDetails(false)}>
              <div className="cart-modal-content" onClick={e => e.stopPropagation()}>
                <h3 className="cart-modal-title">🛒 ตะกร้าสินค้า</h3>
                {cart.map((item) => (
                  <div key={item.uniqueId} className="cart-item">
                    <div className="cart-item-header">
                      <span className="cart-item-name">{item.name}</span>
                      <div className="cart-item-actions">
                        <span className="cart-item-price">{item.price}.-</span>
                        <button onClick={() => removeFromCart(item.uniqueId)} className="remove-btn">ลบ</button>
                      </div>
                    </div>
                    <input 
                      type="text" 
                      placeholder="📝 ระบุรายละเอียด (เช่น เผ็ดมาก, ไม่ใส่ผัก)"
                      value={item.note}
                      onChange={(e) => updateNote(item.uniqueId, e.target.value)}
                      className="note-input"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
export default App