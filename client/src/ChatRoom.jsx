import React, { useEffect, useState, useRef } from 'react'
import { io } from 'socket.io-client'
import axios from 'axios'

export default function ChatRoom({ roomId }){
  const [phone, setPhone] = useState('');
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const socketRef = useRef(null);

  useEffect(()=>{
    const stored = localStorage.getItem('tf_phone');
    if (stored) setPhone(stored);
  },[]);

  function connect(){
    if (!phone) return alert('enter phone');
    localStorage.setItem('tf_phone', phone);
    const s = io((import.meta.env.VITE_API_BASE || '') , { transports: ['websocket'] });
    socketRef.current = s;
    s.on('connect', ()=>{
      s.emit('join_room', { roomId, phone, ua: navigator.userAgent, platform: navigator.platform }, (res)=>{
        if (res && res.error) { alert(res.error); s.disconnect(); return; }
        setConnected(true);
      });

      s.on('recent_messages', (msgs)=> setMessages(msgs));
      s.on('message', (m)=> setMessages(prev=>[...prev, m]));
      s.on('presence_update', (p)=> console.log('presence', p));
      s.on('typing', (t)=> console.log('typing', t));
      s.on('read_receipt', (r)=> console.log('read', r));
    });
  }

  function sendMessage(){
    if (!socketRef.current) return;
    socketRef.current.emit('message_send', { roomId, sender_phone: phone, text }, (res)=>{
      if (res && res.ok) setText('');
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto bg-white p-4 rounded shadow">
        <h2 className="text-lg font-bold mb-2">Room {roomId}</h2>
        {!connected ? (
          <div>
            <label>Your phone</label>
            <input value={phone} onChange={e=>setPhone(e.target.value)} className="w-full p-2 border rounded mb-2" />
            <button onClick={connect} className="bg-green-600 text-white px-3 py-2 rounded">Connect</button>
          </div>
        ) : (
          <div>
            <div className="h-64 overflow-auto border p-2 mb-2 bg-gray-50">
              {messages.map((m,i)=>(
                <div key={i} className="mb-1"><strong>{m.sender_phone}:</strong> {m.text}</div>
              ))}
            </div>
            <div className="flex gap-2">
              <input className="flex-1 p-2 border rounded" value={text} onChange={e=>setText(e.target.value)} />
              <button onClick={sendMessage} className="bg-blue-600 text-white px-3 py-2 rounded">Send</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
