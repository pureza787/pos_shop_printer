import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true // เปิดให้ทดสอบ PWA ในเครื่องตัวเองได้
      },
      manifest: {
        name: 'My Food Order', // ชื่อเต็มแอป
        short_name: 'FoodPOS', // ชื่อที่จะอยู่ใต้ไอคอนแอป
        description: 'ระบบสแกนสั่งอาหาร',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone', // ให้แสดงผลเต็มจอเหมือนแอป
        icons: [
          {
            src: 'pwa-192x192.png', // เดี๋ยวเราค่อยหารูปมาใส่ทีหลัง
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})