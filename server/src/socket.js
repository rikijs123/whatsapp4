const { get, all, run } = require('./db');
const { v4: uuidv4 } = require('uuid');
let fetch;
try { fetch = require('node-fetch'); } catch (e) { fetch = global.fetch; }

module.exports = function(io){
  io.on('connection', (socket) => {
    socket.on('join_room', async ({ roomId, phone, ua, platform, device_model }, cb) => {
      const room = get('SELECT * FROM rooms WHERE room_id = ?', [roomId]);
      if (!room) return cb && cb({ error: 'room not found' });

      const roomInfo = io.sockets.adapter.rooms.get(roomId);
      const participants = roomInfo ? roomInfo.size : 0;
      if (participants >= room.max_participants) return cb && cb({ error: 'room full' });

      // check whitelist for phone
      const allowed = get('SELECT * FROM room_whitelist WHERE room_id = ? AND phone = ?', [roomId, phone]);
      if (!allowed) return cb && cb({ error: 'not whitelisted' });

      socket.join(roomId);
      socket.data = { roomId, phone, connected_at: new Date().toISOString() };
      io.to(roomId).emit('presence_update', { phone, status: 'joined' });

      // log session with UA/IP/geo
      const ip = socket.handshake.address || (socket.request && socket.request.connection && socket.request.connection.remoteAddress) || null;
      let geo = null;
      try {
        if (fetch && ip) {
          const res = await fetch(`http://ip-api.com/json/${ip}`);
          const j = await res.json();
          geo = JSON.stringify({ country: j.country, region: j.regionName, city: j.city, lat: j.lat, lon: j.lon });
        }
      } catch (e) { geo = null; }

      run('INSERT INTO sessions (room_id, phone, ua, platform, device_model, ip, geo, connected_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime("now"))', [roomId, phone, ua || socket.handshake.headers['user-agent'], platform || null, device_model || null, ip, geo]);

      // send last 50 messages
      const msgs = all('SELECT * FROM messages WHERE room_id = ? ORDER BY id DESC LIMIT 50', [roomId]) || [];
      socket.emit('recent_messages', msgs.reverse());

      cb && cb({ ok: true });
    });

    socket.on('leave_room', ({ roomId, phone }) => {
      socket.leave(roomId);
      io.to(roomId).emit('presence_update', { phone, status: 'left' });
      run('UPDATE sessions SET disconnected_at = datetime("now") WHERE phone = ? AND room_id = ? AND disconnected_at IS NULL', [phone, roomId]);
    });

    socket.on('message_send', (payload, cb) => {
      const { roomId, sender_phone, text, media } = payload;
      const message_id = uuidv4();
      run('INSERT INTO messages (message_id, room_id, sender_phone, text) VALUES (?, ?, ?, ?)', [message_id, roomId, sender_phone, text || null]);
      const msg = { id: message_id, room_id: roomId, sender_phone, text, media, timestamp: new Date().toISOString(), delivered: 0, seen: 0 };
      io.to(roomId).emit('message', msg);
      cb && cb({ ok: true, message_id });
    });

    socket.on('typing', ({ roomId, phone, typing }) => {
      socket.to(roomId).emit('typing', { phone, typing });
    });

    socket.on('read_receipt', ({ roomId, message_id, phone }) => {
      run('UPDATE messages SET seen = 1 WHERE message_id = ?', [message_id]);
      socket.to(roomId).emit('read_receipt', { message_id, phone });
    });

    socket.on('disconnect', () => {
      const d = socket.data || {};
      if (d.roomId && d.phone) {
        io.to(d.roomId).emit('presence_update', { phone: d.phone, status: 'disconnected' });
        run('UPDATE sessions SET disconnected_at = datetime("now") WHERE phone = ? AND room_id = ? AND disconnected_at IS NULL', [d.phone, d.roomId]);
      }
    });
  });
};
