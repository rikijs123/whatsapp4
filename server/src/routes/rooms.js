const express = require('express');
const router = express.Router();
const { run, get, all } = require('../db');
const { v4: uuidv4 } = require('uuid');

router.post('/create-room', (req, res) => {
  const roomId = uuidv4();
  const max_participants = 10;
  run('INSERT INTO rooms (room_id, max_participants) VALUES (?, ?)', [roomId, max_participants]);
  const host = req.body.phone || null;
  if (host) run('UPDATE rooms SET host_phone = ? WHERE room_id = ?', [host, roomId]);
  const url = `https://${process.env.HOST || 'localhost:3000'}/r/${roomId}`;
  res.json({ roomId, url });
});

router.get('/:id', (req, res) => {
  const room = get('SELECT * FROM rooms WHERE room_id = ?', [req.params.id]);
  if (!room) return res.status(404).json({ error: 'not found' });
  res.json(room);
});

module.exports = router;
