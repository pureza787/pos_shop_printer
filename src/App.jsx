import { useState, useEffect, useRef } from 'react'
import { db } from './firebase'
import { 
  collection, addDoc, serverTimestamp, query, where, onSnapshot, 
  deleteDoc, doc 
} from 'firebase/firestore'
import './App.css'

function App() {
  const [cart, setCart] = useState([])
  const [myOrders, setMyOrders] = useState([])
  const [isOrdering, setIsOrdering] = useState(false)
  const [showCartDetails, setShowCartDetails] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)

  const [menuItems, setMenuItems] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('ทั้งหมด')
  const [activeCategories, setActiveCategories] = useState([])
  const CATEGORIES = ['ทั้งหมด', ...activeCategories]

  const [showNoodleModal, setShowNoodleModal] = useState(false)
  const [selectedNoodleDish, setSelectedNoodleDish] = useState(null)
  
  const [noodleType, setNoodleType] = useState('เส้นเล็ก')
  const [soupType, setSoupType] = useState('น้ำใส')
  const [noodleSize, setNoodleSize] = useState('ธรรมดา')
  const [noodleOptions, setNoodleOptions] = useState([])
  const [noodleQty, setNoodleQty] = useState(1)

  const NOODLE_LIST = ['เส้นเล็ก', 'เส้นหมี่', 'เส้นใหญ่', 'บะหมี่', 'วุ้นเส้น', 'มาม่า', 'เกาเหลา'];
  const SOUP_LIST = ['น้ำใส', 'น้ำตก', 'ต้มยำ', 'ต้มยำน้ำข้น', 'แห้ง'];
  const EXTRA_LIST = ['ไม่ใส่ผัก', 'ไม่ใส่กระเทียมเจียว', 'ไม่ชูรส', 'เผ็ดน้อย', 'เผ็ดมาก'];

  const scrollRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const params = new URLSearchParams(window.location.search);
  const tableNo = params.get('table') || '1';

  useEffect(() => {
    const unsubProducts = onSnapshot(collection(db, "products"), (snap) => setMenuItems(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubSettings = onSnapshot(doc(db, "settings", "shopConfig"), (d) => {
       if (d.exists() && d.data().categories) setActiveCategories(d.data().categories); 
       else setActiveCategories(['อาหารจานเดียว', 'ก๋วยเตี๋ยว', 'เครื่องดื่ม']);
    });
    
    const qOrder = query(collection(db, "orders"), where("table_no", "==", tableNo));
    const unsubOrders = onSnapshot(qOrder, (snap) => {
        let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        setMyOrders(list);
    });
    return () => { unsubProducts(); unsubSettings(); unsubOrders(); };
  }, [tableNo])

  const handleMouseDown = (e) => { setIsDragging(true); setStartX(e.pageX - scrollRef.current.offsetLeft); setScrollLeft(scrollRef.current.scrollLeft); };
  const handleMouseUp = () => setIsDragging(false);
  const handleMouseLeave = () => setIsDragging(false);
  const handleMouseMove = (e) => { if (!isDragging) return; e.preventDefault(); const x = e.pageX - scrollRef.current.offsetLeft; const walk = (x - startX) * 2; scrollRef.current.scrollLeft = scrollLeft - walk; };

  const handleItemClick = (item) => {
    if (item.category === 'ก๋วยเตี๋ยว') {
      setSelectedNoodleDish(item); 
      setNoodleType('เส้นเล็ก'); setSoupType('น้ำใส'); setNoodleSize('ธรรมดา'); setNoodleOptions([]); setNoodleQty(1);
      setShowNoodleModal(true);
    } else {
      addToCart(item); 
    }
  }

  const addToCart = (item, customNote = '') => {
    setCart(prev => [...prev, { ...item, uniqueId: Date.now() + Math.random(), note: customNote, qty: 1, price: Number(item.price) }])
  }
  const toggleNoodleOption = (opt) => { if (noodleOptions.includes(opt)) setNoodleOptions(noodleOptions.filter(o => o !== opt)); else setNoodleOptions([...noodleOptions, opt]); }
  const adjustQty = (amount) => { const newQty = noodleQty + amount; if (newQty >= 1) setNoodleQty(newQty); }
  
  // ✅ แก้ไขส่วนที่ 1: เพิ่ม isExtra เพื่อระบุว่าเป็นชามพิเศษ
  const confirmNoodleOrder = () => {
    if (!selectedNoodleDish) return;
    const basePrice = Number(selectedNoodleDish.price);
    const extraPrice = noodleSize === 'พิเศษ' ? 10 : 0;
    const finalPrice = basePrice + extraPrice;
    const optionString = noodleOptions.length > 0 ? ` [${noodleOptions.join(', ')}]` : '';
    const fullName = `${selectedNoodleDish.name} (${noodleType} ${soupType}) - ${noodleSize}${optionString}`;
    
    // เช็คว่าพิเศษหรือไม่
    const isExtra = noodleSize === 'พิเศษ';

    for (let i = 0; i < noodleQty; i++) { 
        addToCart({ 
            ...selectedNoodleDish, 
            name: fullName, 
            price: finalPrice,
            isExtra: isExtra // <--- ส่งค่านี้ไปด้วยเพื่อใช้เช็คราคา
        }); 
    }
    setShowNoodleModal(false); setSelectedNoodleDish(null);
  }

  const removeFromCart = (uid) => setCart(cart.filter(i => i.uniqueId !== uid))
  const updateNote = (uid, text) => setCart(cart.map(i => i.uniqueId === uid ? { ...i, note: text } : i))
  
  // ✅ แก้ไขส่วนที่ 2: ระบบคำนวณราคาใหม่ (Verify Price) ป้องกัน F12
  const handleConfirmOrder = async () => {
    if (cart.length === 0) return;
    setIsOrdering(true);
    try {
      // 1. สร้างรายการสินค้าที่ "ตรวจสอบราคาแล้ว" (Verified Items)
      const verifiedItems = cart.map(cartItem => {
          // ค้นหาสินค้าตัวจริงจากเมนู (menuItems คือข้อมูลที่ดึงจาก DB เชื่อถือได้)
          const realProduct = menuItems.find(p => p.id === cartItem.id);
          
          if (realProduct) {
              // ถ้ารายการถูกต้อง ให้ใช้ราคาจริงจากระบบ
              let safePrice = Number(realProduct.price);
              
              // เช็คเงื่อนไขบวกราคาเพิ่ม (เช่น ก๋วยเตี๋ยวพิเศษ +10)
              if (cartItem.isExtra) {
                  safePrice += 10;
              }

              // คืนค่ารายการเดิม แต่เปลี่ยนราคาให้เป็นราคาที่ถูกต้อง (Safe Price)
              return { ...cartItem, price: safePrice };
          } else {
              // กรณีไม่เจอสินค้า (อาจจะถูกลบไปแล้ว) ให้ใช้ค่าเดิมไปก่อน
              return cartItem; 
          }
      });

      // 2. คำนวณราคารวมใหม่ จากรายการที่ตรวจสอบแล้วเท่านั้น
      const safeTotalPrice = verifiedItems.reduce((s, i) => s + i.price, 0);

      // 3. บันทึกลง Database
      await addDoc(collection(db, "orders"), {
        table_no: tableNo, 
        items: verifiedItems, // ส่งรายการที่แก้ราคาให้ถูกแล้ว
        total_price: safeTotalPrice, // ส่งราคารวมที่คำนวณใหม่
        status: "kitchen", 
        timestamp: serverTimestamp()
      });

      setCart([]); setShowCartDetails(false); alert("✅ ส่งออเดอร์เรียบร้อย!");
    } catch (e) { alert("❌ ผิดพลาด: " + e.message); } finally { setIsOrdering(false); }
  }

  const filteredItems = menuItems.filter(i => {
    const matchCat = selectedCategory === 'ทั้งหมด' || i.category === selectedCategory;
    const isAct = activeCategories.includes(i.category);
    return matchCat && i.available !== false && isAct;
  });
  
  const cartTotal = cart.reduce((s, i) => s + i.price, 0);
  const grandTotalHistory = myOrders.reduce((sum, order) => sum + (order.total_price || 0), 0);

  return (
    <div className="app-container">
      {/* HEADER */}
      <header className="app-header">
        <div className="header-top">
          <div className="logo-group">
             <img src="https://chonburiartmediagroup.com/wp-content/uploads/2021/02/LOGO26-960x673.jpg" alt="Logo" className="logo-img" />
             <h1 className="app-title">ร้านอร่อย</h1>
          </div>
          
          <div className="header-actions">
            {myOrders.length > 0 && (
                <button onClick={() => setShowHistoryModal(true)} className="history-toggle-btn">
                   📋 ที่สั่งไป
                   <span className="count-badge">฿{grandTotalHistory.toLocaleString()}</span>
                </button>
            )}
            <span className="table-badge">โต๊ะ {tableNo}</span>
          </div>
        </div>

        <div className="category-scroll" ref={scrollRef} onMouseDown={handleMouseDown} onMouseLeave={handleMouseLeave} onMouseUp={handleMouseUp} onMouseMove={handleMouseMove}>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => { if(!isDragging) setSelectedCategory(cat); }} className={`category-btn ${selectedCategory === cat ? 'active' : ''}`}>{cat}</button>
          ))}
        </div>
      </header>

      {/* MENU GRID */}
      <div className="content-area">
        {menuItems.length === 0 ? <div className="loading-text"><p>⏳ กำลังโหลดเมนู...</p></div> : (
          <div className="menu-grid">
            {filteredItems.map((item) => (
              <div key={item.id} className="menu-card">
                <img src={item.img || 'https://via.placeholder.com/150'} className="menu-img" alt={item.name} />
                <div className="menu-content">
                  <div className="menu-name">{item.name}</div>
                  <div className="menu-category">{item.category}</div>
                  <div className="menu-footer">
                    <span className="price-tag">{item.price}.-</span>
                    <button onClick={() => handleItemClick(item)} className="add-btn">+</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ✅ HISTORY MODAL (ปรับสีตัวหนังสือเป็นสีดำ) */}
      {showHistoryModal && (
        <div className="cart-modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="cart-modal-content" onClick={e => e.stopPropagation()}>
             <div className="modal-header">
                <h3>📋 รายการที่สั่งไปแล้ว</h3>
                <button onClick={() => setShowHistoryModal(false)} className="btn-close-modal">✖</button>
             </div>
             
             {/* ยอดรวม */}
             <div style={{
                 backgroundColor: '#d1fae5', /* สีเขียวอ่อนกว่าเดิมให้อ่านง่าย */
                 border: '1px solid #10b981',
                 borderRadius: '8px',
                 padding: '15px',
                 marginBottom: '15px',
                 display: 'flex',
                 justifyContent: 'space-between',
                 alignItems: 'center'
             }}>
                 <span style={{color:'#064e3b', fontWeight:'bold'}}>ยอดรวมทั้งสิ้น</span>
                 <span style={{color:'#064e3b', fontSize:'1.5rem', fontWeight:'bold'}}>
                    ฿{grandTotalHistory.toLocaleString()}
                 </span>
             </div>

             {/* รายการอาหาร (ปรับสีดำ Black) */}
             <div style={{maxHeight:'55vh', overflowY:'auto'}}>
                {myOrders.length === 0 && <p style={{textAlign:'center', color:'#999'}}>ยังไม่ได้สั่งอะไรเลย</p>}
                
                {myOrders.map((order, index) => (
                    <div key={order.id} style={{
                        borderBottom: '1px solid #ddd', 
                        padding: '12px 0'
                    }}>
                        <div style={{fontSize:'0.85rem', color:'#555', marginBottom:'6px', fontWeight:'500'}}>
                            บิลที่ {myOrders.length - index} • {order.timestamp ? new Date(order.timestamp.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'} น.
                        </div>
                        
                        {order.items.map((item, idx) => (
                           <div key={idx} style={{display:'flex', justifyContent:'space-between', marginBottom:'6px', alignItems:'flex-start'}}>
                                {/* ชื่อเมนูสีดำชัดๆ */}
                                <div style={{color:'#000', fontSize:'1rem', fontWeight:'500'}}>
                                    {item.name} 
                                    {item.qty > 1 && <span style={{color:'#d32f2f', fontWeight:'bold', marginLeft:'5px'}}>x{item.qty}</span>}
                                    {item.note && <div style={{fontSize:'0.85rem', color:'#d35400'}}>📝 {item.note}</div>}
                                </div>
                                {/* ราคาสีดำเข้ม */}
                                <span style={{color:'#000', fontWeight:'bold', minWidth:'50px', textAlign:'right'}}>
                                   {(item.price * (item.qty || 1)).toLocaleString()}
                                </span>
                           </div>
                        ))}
                    </div>
                ))}
             </div>
          </div>
        </div>
      )}

      {/* CART BAR */}
      {cart.length > 0 && (
        <>
          <div className="cart-bar">
            <div onClick={() => setShowCartDetails(!showCartDetails)} className="cart-info">
              <div className="cart-count">{cart.length} รายการ</div>
              <div className="cart-subtext">ดูรายละเอียด 🔼</div>
            </div>
            <button onClick={handleConfirmOrder} disabled={isOrdering} className="order-btn">{isOrdering ? 'ส่ง...' : `สั่งเลย ${cartTotal} ฿`}</button>
          </div>
          
          {showCartDetails && (
            <div className="cart-modal-overlay" onClick={() => setShowCartDetails(false)}>
              <div className="cart-modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="cart-modal-title">🛒 ตะกร้าสินค้า</h3>
                    <button onClick={() => setShowCartDetails(false)} className="btn-close-modal">✖</button>
                </div>
                {cart.map((item) => (
                  <div key={item.uniqueId} className="cart-item">
                    <div className="cart-item-header">
                      <span className="cart-item-name">{item.name}</span>
                      <div className="cart-item-actions">
                        <span className="cart-item-price">{item.price}.-</span>
                        <button onClick={() => removeFromCart(item.uniqueId)} className="remove-btn">ลบ</button>
                      </div>
                    </div>
                    <input type="text" placeholder="📝 ระบุรายละเอียดเพิ่มเติม" value={item.note} onChange={(e) => updateNote(item.uniqueId, e.target.value)} className="note-input" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* NOODLE MODAL */}
      {showNoodleModal && (
        <div className="cart-modal-overlay" onClick={() => setShowNoodleModal(false)}>
          <div className="cart-modal-content noodle-modal" onClick={e => e.stopPropagation()}>
            <h3 className="noodle-title">🍜 ปรุงก๋วยเตี๋ยว</h3>
            <div className="noodle-section">
              <h4 className="noodle-label">เลือกเส้น</h4>
              <div className="noodle-options">
                {NOODLE_LIST.map(opt => (
                  <button key={opt} onClick={() => setNoodleType(opt)} className={`option-btn ${noodleType === opt ? 'selected' : ''}`}>{opt}</button>
                ))}
              </div>
            </div>
            <div className="noodle-section">
              <h4 className="noodle-label">เลือกน้ำซุป</h4>
              <div className="noodle-options">
                {SOUP_LIST.map(opt => (
                  <button key={opt} onClick={() => setSoupType(opt)} className={`option-btn ${soupType === opt ? 'selected' : ''}`}>{opt}</button>
                ))}
              </div>
            </div>
            <div className="noodle-section">
              <h4 className="noodle-label">ขนาด</h4>
              <div className="size-selector">
                <button onClick={() => setNoodleSize('ธรรมดา')} className={`size-btn ${noodleSize === 'ธรรมดา' ? 'active' : ''}`}>
                  ธรรมดา
                </button>
                <button onClick={() => setNoodleSize('พิเศษ')} className={`size-btn ${noodleSize === 'พิเศษ' ? 'active' : ''}`}>
                  พิเศษ (+10.-)
                </button>
              </div>
            </div>
            <div className="noodle-section">
              <h4 className="noodle-label">เพิ่มเติม</h4>
              <div className="noodle-options-grid">
                {EXTRA_LIST.map(opt => (
                  <button key={opt} onClick={() => toggleNoodleOption(opt)} className={`checkbox-btn ${noodleOptions.includes(opt) ? 'checked' : ''}`}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div className="noodle-footer-action">
              <div className="qty-control">
                <button onClick={() => adjustQty(-1)} className="qty-btn">-</button>
                <span className="qty-display">{noodleQty}</span>
                <button onClick={() => adjustQty(1)} className="qty-btn">+</button>
              </div>
              <button onClick={confirmNoodleOrder} className="order-btn confirm-noodle-btn">
                ใส่ตะกร้า {((Number(selectedNoodleDish?.price) + (noodleSize === 'พิเศษ' ? 10 : 0)) * noodleQty)} ฿
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default App
