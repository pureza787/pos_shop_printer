import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'       
import Kitchen from './Kitchen.jsx' 
import Admin from './Admin.jsx'     
import './index.css'

// 1. แปลง URL เป็นตัวพิมพ์เล็กทั้งหมดก่อนเช็ค (แก้ปัญหา /Kitchen vs /kitchen)
const path = window.location.pathname.toLowerCase();

let Component = App; // ค่าเริ่มต้นคือหน้าร้าน

// 2. เช็คเงื่อนไข
if (path === '/kitchen') {
  Component = Kitchen;
} else if (path === '/admin') {
  Component = Admin;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Component />
  </React.StrictMode>,
)