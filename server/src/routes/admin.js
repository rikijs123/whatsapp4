const express = require('express');
const router = express.Router();
const { get, all, run } = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
let twilioClient = null;
if (process.env.SMS_PROVIDER === 'twilio') {
  try {
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  } catch (e) { console.error('Twilio init failed', e.message); }
}

function requireAdmin(req, res, next) {
  const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'auth required' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    req.admin = payload; // should contain id and username
    next();
  } catch (e) { return res.status(401).json({ error: 'invalid token' }); }
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const admin = get('SELECT * FROM admins WHERE username = ?', [username]);
  if (!admin) return res.status(401).json({ error: 'invalid' });
  const ok = await bcrypt.compare(password, admin.password_hash);
  if (!ok) return res.status(401).json({ error: 'invalid' });
  const token = jwt.sign({ id: admin.id, username }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '8h' });
  run('INSERT INTO admin_logs (admin_id, action, target, metadata) VALUES (?, ?, ?, ?)', [admin.id, 'login', null, 'admin logged in']);
  res.json({ token });
});

router.get('/rooms', requireAdmin, (req, res) => {
  const rooms = all('SELECT * FROM rooms');
  res.json(rooms);
});

router.get('/rooms/:id/active-users', requireAdmin, (req, res) => {
  const roomId = req.params.id;
  const rows = all('SELECT phone, ua, platform, device_model, ip, geo, connected_at, disconnected_at FROM sessions WHERE room_id = ? ORDER BY connected_at DESC', [roomId]);
  res.json(rows);
});

router.post('/rooms/:id/set-max', requireAdmin, (req, res) => {
  const { max } = req.body;
  const id = req.params.id;
  if (!max || max < 2) return res.status(400).json({ error: 'min 2' });
  run('UPDATE rooms SET max_participants = ? WHERE room_id = ?', [max, id]);
  run('INSERT INTO admin_logs (admin_id, action, target, metadata) VALUES (?, ?, ?, ?)', [req.admin.id, 'set-max', id, `max=${max}`]);
  res.json({ ok: true });
});

router.get('/whitelist', requireAdmin, (req, res) => {
  const list = all('SELECT * FROM room_whitelist');
  res.json(list);
});

router.post('/whitelist', requireAdmin, (req, res) => {
  const { room_id, phone } = req.body;
  if (!phone || !room_id) return res.status(400).json({ error: 'missing' });
  run('INSERT INTO room_whitelist (room_id, phone, added_by_admin) VALUES (?, ?, ?)', [room_id, phone, req.admin.id]);
  run('INSERT INTO admin_logs (admin_id, action, target, metadata) VALUES (?, ?, ?, ?)', [req.admin.id, 'whitelist-add', room_id, phone]);
  res.json({ ok: true });
});

router.delete('/whitelist', requireAdmin, (req, res) => {
  const { id } = req.body;
  run('DELETE FROM room_whitelist WHERE id = ?', [id]);
  run('INSERT INTO admin_logs (admin_id, action, target, metadata) VALUES (?, ?, ?, ?)', [req.admin.id, 'whitelist-remove', id, null]);
  res.json({ ok: true });
});

router.get('/sessions/active', requireAdmin, (req, res) => {
  const sessions = all('SELECT * FROM sessions ORDER BY created_at DESC LIMIT 200');
  res.json(sessions);
});

router.get('/logs', requireAdmin, (req, res) => {
  const logs = all('SELECT * FROM admin_logs ORDER BY ts DESC LIMIT 500');
  res.json(logs);
});

router.post('/test-sms', requireAdmin, async (req, res) => {
  const { phone, message } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone required' });
  const body = message || 'Test SMS from Two Friend Chat';
  if (process.env.SMS_PROVIDER === 'twilio' && twilioClient) {
    try {
      await twilioClient.messages.create({ body, from: process.env.TWILIO_FROM, to: phone });
      run('INSERT INTO admin_logs (admin_id, action, target, metadata) VALUES (?, ?, ?, ?)', [req.admin.id, 'test-sms', phone, body]);
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'twilio error', detail: e.message });
    }
  }
  // fallback: log
  console.log('TEST SMS', phone, body);
  run('INSERT INTO admin_logs (admin_id, action, target, metadata) VALUES (?, ?, ?, ?)', [req.admin.id, 'test-sms-mock', phone, body]);
  res.json({ ok: true, mock: true });
});

module.exports = router;
