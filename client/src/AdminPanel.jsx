import React, { useState, useEffect } from 'react'
import axios from 'axios'

export default function AdminPanel(){
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rooms, setRooms] = useState([]);
  const [whitelist, setWhitelist] = useState([]);
  const [roomId, setRoomId] = useState('');
  const [phone, setPhone] = useState('');

  async function login(){
    const res = await axios.post((import.meta.env.VITE_API_BASE || '') + '/admin/login', { username, password });
    setToken(res.data.token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
    await loadRooms();
    await loadWhitelist();
  }

  async function loadRooms(){
    const res = await axios.get((import.meta.env.VITE_API_BASE || '') + '/admin/rooms');
    setRooms(res.data);
  }

  async function loadWhitelist(){
    const res = await axios.get((import.meta.env.VITE_API_BASE || '') + '/admin/whitelist');
    setWhitelist(res.data);
  }

  async function addWhitelist(){
    await axios.post((import.meta.env.VITE_API_BASE || '') + '/admin/whitelist', { room_id: roomId, phone });
    loadWhitelist();
  }

  async function loadRoomSessions(id){
    const res = await axios.get((import.meta.env.VITE_API_BASE || '') + `/admin/rooms/${id}/active-users`);
    return res.data;
  }

  const [sessions, setSessions] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [mapLatLon, setMapLatLon] = useState(null);

  async function showRoomSessions(id){
    const s = await loadRoomSessions(id);
    setSessions(s || []);
    setSelectedRoom(id);
  }

  function openMapFor(session){
    if (!session || !session.geo) return alert('No geo data');
    try{
      const g = JSON.parse(session.geo);
      if (g.lat && g.lon) setMapLatLon({ lat: g.lat, lon: g.lon });
      else alert('No coordinates in geo');
    }catch(e){ alert('Invalid geo data'); }
  }

  function closeMap(){ setMapLatLon(null); }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-3xl mx-auto bg-white p-4 rounded shadow">
        <h2 className="text-lg font-bold mb-2">Admin Panel</h2>
        {!token ? (
          <div>
            <input placeholder="username" value={username} onChange={e=>setUsername(e.target.value)} className="p-2 border mb-2 w-full" />
            <input placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} className="p-2 border mb-2 w-full" />
            <button onClick={login} className="bg-blue-600 text-white px-3 py-2 rounded">Login</button>
          </div>
        ) : (
          <div>
            <h3 className="font-semibold mt-4">Rooms</h3>
            <div className="grid gap-2">
              {rooms.map(r => (
                <div key={r.room_id} className="p-2 border rounded flex items-center justify-between">
                  <div>
                    <div className="font-medium">{r.room_id}</div>
                    <div className="text-sm text-gray-600">max {r.max_participants}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={()=>showRoomSessions(r.room_id)} className="bg-indigo-600 text-white px-2 py-1 rounded">Sessions</button>
                  </div>
                </div>
              ))}
            </div>

            <h3 className="font-semibold mt-4">Whitelist</h3>
            <div className="flex gap-2 mb-2">
              <input placeholder="room id" value={roomId} onChange={e=>setRoomId(e.target.value)} className="p-2 border" />
              <input placeholder="phone" value={phone} onChange={e=>setPhone(e.target.value)} className="p-2 border" />
              <button onClick={addWhitelist} className="bg-green-600 text-white px-3 py-2 rounded">Add</button>
            </div>
            <ul>{whitelist.map(w=>(<li key={w.id}>{w.phone} — {w.room_id}</li>))}</ul>

            {selectedRoom && (
              <div className="mt-4">
                <h4 className="font-semibold">Sessions for {selectedRoom}</h4>
                <div className="overflow-auto max-h-80 border rounded mt-2">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="p-2">Phone</th>
                        <th className="p-2">UA</th>
                        <th className="p-2">Platform</th>
                        <th className="p-2">IP</th>
                        <th className="p-2">Geo</th>
                        <th className="p-2">Connected</th>
                        <th className="p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map(s => (
                        <tr key={s.phone + s.connected_at} className="border-t">
                          <td className="p-2">{s.phone}</td>
                          <td className="p-2 break-words max-w-xs">{s.ua}</td>
                          <td className="p-2">{s.platform}</td>
                          <td className="p-2">{s.ip}</td>
                          <td className="p-2">{s.geo ? 'yes' : '—'}</td>
                          <td className="p-2">{s.connected_at}</td>
                          <td className="p-2">
                            <button onClick={()=>openMapFor(s)} className="bg-blue-600 text-white px-2 py-1 rounded">Map</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {mapLatLon && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                <div className="bg-white w-11/12 max-w-3xl p-4 rounded">
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-semibold">Map</div>
                    <button onClick={closeMap} className="text-sm text-gray-600">Close</button>
                  </div>
                  <div className="h-96">
                    <iframe
                      className="w-full h-full"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${mapLatLon.lon-0.02}%2C${mapLatLon.lat-0.02}%2C${mapLatLon.lon+0.02}%2C${mapLatLon.lat+0.02}&layer=mapnik&marker=${mapLatLon.lat}%2C${mapLatLon.lon}`}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
