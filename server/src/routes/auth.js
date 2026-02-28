const express = require('express');
const router = express.Router();
const { run, get } = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const OTP_TTL = +(process.env.OTP_TTL_SECONDS || 300);

function sendSmsMock(phone, message) {
  console.log(`SMS to ${phone}: ${message}`);
}

let twilioClient = null;
if (process.env.SMS_PROVIDER === 'twilio') {
  try {
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  } catch (e) {
    console.error('Twilio client init failed', e.message);
    twilioClient = null;
  }
}

// rate limit per phone for OTP sends
const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  keyGenerator: (req) => (req.body && req.body.phone) || req.ip,
  message: { error: 'Too many OTP requests, try later' }
});

router.post('/send-otp', otpLimiter, async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone required' });

  // check whitelist: either global users table or any room whitelist entry
  const allowedUser = get('SELECT * FROM users WHERE phone = ?', [phone]);
  const allowedWhitelist = get('SELECT * FROM room_whitelist WHERE phone = ?', [phone]);
  if (!allowedUser && !allowedWhitelist) return res.status(403).json({ error: 'phone not whitelisted' });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL * 1000).toISOString();

  run('INSERT INTO sessions (phone, otp_hash, otp_expires_at, created_at) VALUES (?, ?, ?, datetime("now"))', [phone, otpHash, expiresAt]);

  // send via provider or mock
  if (process.env.SMS_PROVIDER === 'twilio' && twilioClient) {
    try {
      await twilioClient.messages.create({ body: `Your OTP is ${otp}`, from: process.env.TWILIO_FROM, to: phone });
    } catch (e) {
      console.error('Twilio send error', e.message);
      // fallback to mock logging
      sendSmsMock(phone, `Your OTP is ${otp}`);
    }
  } else {
    sendSmsMock(phone, `Your OTP is ${otp}`);
  }

  res.json({ ok: true, ttl: OTP_TTL });
});

router.post('/verify-otp', async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) return res.status(400).json({ error: 'phone and otp required' });
  const ip = req.ip || req.connection && req.connection.remoteAddress;

  // check lock for phone or ip
  const maxFailed = +(process.env.OTP_MAX_FAILED || 5);
  const lockMinutes = +(process.env.OTP_LOCK_MINUTES || 15);

  const lockByPhone = get('SELECT * FROM otp_attempts WHERE phone = ? ORDER BY id DESC LIMIT 1', [phone]);
  if (lockByPhone && lockByPhone.locked_until && new Date(lockByPhone.locked_until) > new Date()) {
    return res.status(429).json({ error: 'too many failed attempts for this phone, try later' });
  }
  const lockByIp = get('SELECT * FROM otp_attempts WHERE ip = ? ORDER BY id DESC LIMIT 1', [ip]);
  if (lockByIp && lockByIp.locked_until && new Date(lockByIp.locked_until) > new Date()) {
    return res.status(429).json({ error: 'too many failed attempts from this IP, try later' });
  }

  const row = get('SELECT * FROM sessions WHERE phone = ? ORDER BY created_at DESC LIMIT 1', [phone]);
  if (!row) return res.status(400).json({ error: 'no otp sent' });
  if (!row.otp_expires_at || new Date(row.otp_expires_at) < new Date()) return res.status(400).json({ error: 'otp expired' });

  const ok = await bcrypt.compare(otp, row.otp_hash);
  if (!ok) {
    // increment attempt for phone
    const now = new Date().toISOString();
    const p = get('SELECT * FROM otp_attempts WHERE phone = ? ORDER BY id DESC LIMIT 1', [phone]);
    if (!p) {
      run('INSERT INTO otp_attempts (phone, ip, attempts, last_attempt_at) VALUES (?, ?, 1, ?)', [phone, ip, 1, now]);
    } else {
      const attempts = (p.attempts || 0) + 1;
      if (attempts >= maxFailed) {
        const locked_until = new Date(Date.now() + lockMinutes * 60000).toISOString();
        run('INSERT INTO otp_attempts (phone, ip, attempts, last_attempt_at, locked_until) VALUES (?, ?, ?, ?, ?)', [phone, ip, attempts, now, locked_until]);
      } else {
        run('INSERT INTO otp_attempts (phone, ip, attempts, last_attempt_at) VALUES (?, ?, ?, ?)', [phone, ip, attempts, now]);
      }
    }
    return res.status(401).json({ error: 'invalid otp' });
  }

  // success: reset attempts (insert zero/clear)
  run('INSERT INTO otp_attempts (phone, ip, attempts, last_attempt_at) VALUES (?, ?, 0, datetime("now"))', [phone, ip]);

  // ensure user exists and mark verified
  const user = get('SELECT * FROM users WHERE phone = ?', [phone]);
  if (!user) {
    run('INSERT INTO users (phone, verified, created_at) VALUES (?, 1, datetime("now"))', [phone]);
  } else {
    run('UPDATE users SET verified = 1 WHERE phone = ?', [phone]);
  }

  // create session token
  const token = jwt.sign({ phone }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '12h' });
  run('UPDATE sessions SET session_token = ? WHERE id = ?', [token, row.id]);

  res.cookie(process.env.SESSION_COOKIE_NAME || 'tfchat_session', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
  res.json({ ok: true, token });
});

module.exports = router;
