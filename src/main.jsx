import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'       // หน้าร้าน
import Kitchen from './Kitchen.jsx' // หน้าครัว
import Admin from './Admin.jsx'     // หน้าแอดมิน
import './index.css'

// ตรวจสอบ URL เพื่อเลือกว่าจะเปิดหน้าไหน
const path = window.location.pathname;

let Component = App; // ค่าเริ่มต้นคือหน้าร้าน
if (path === '/kitchen') Component = Kitchen;
if (path === '/admin') Component = Admin;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Component />
  </React.StrictMode>,
)