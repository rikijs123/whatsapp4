import React, { useState } from 'react'
import axios from 'axios'
import QRCode from 'qrcode.react'
import ChatRoom from './ChatRoom'
import AdminPanel from './AdminPanel'

export default function App(){
  const [phone, setPhone] = useState('');
  const [roomUrl, setRoomUrl] = useState(null);

  async function createRoom(){
    try{
      const res = await axios.post((import.meta.env.VITE_API_BASE || '') + '/create-room', { phone });
      setRoomUrl(res.data.url);
    }catch(e){
      alert('Error creating room');
    }
  }

  const path = window.location.pathname || '/';
  if (path.startsWith('/r/')) {
    const roomId = path.split('/r/')[1];
    return <ChatRoom roomId={roomId} />;
  }

  if (path === '/admin') return <AdminPanel />;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-full max-w-md p-6 bg-white rounded shadow">
        <h1 className="text-xl font-bold mb-4">Two Friend Chat — Generate Link</h1>
        <label className="block mb-2">Your phone (whitelisted)</label>
        <input value={phone} onChange={e=>setPhone(e.target.value)} className="w-full p-2 border rounded mb-4" />
        <button onClick={createRoom} className="bg-blue-600 text-white px-4 py-2 rounded">Ģenerēt saiti</button>
        {roomUrl && (
          <div className="mt-4">
            <p className="break-words">{roomUrl}</p>
            <div className="mt-2">
              <QRCode value={roomUrl} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
