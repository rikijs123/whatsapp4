require('dotenv').config();
const express = require('express');
const http = require('http');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('./db');
const bcrypt = require('bcrypt');
const path = require('path');

// run migrations
require('./migrate');

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server, { cors: { origin: true, credentials: true } });

// security
app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: true, credentials: true }));

const limiter = rateLimit({
  windowMs: +(process.env.RATE_LIMIT_WINDOW_MS || 60000),
  max: +(process.env.RATE_LIMIT_MAX || 100)
});
app.use(limiter);

// basic static for client build if provided
app.use('/static', express.static(path.join(__dirname, '..', '..', 'client', 'dist')));

// mount routes
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const adminRoutes = require('./routes/admin');

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/admin', adminRoutes);

// also expose short paths per spec
app.use('/', authRoutes); // exposes /send-otp and /verify-otp
app.use('/', roomRoutes); // exposes /create-room and /:id
app.use('/admin', adminRoutes); // exposes /admin/login etc.

// simple room URL
app.get('/r/:id', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'client', 'dist', 'index.html'));
});

// default admin seed
(async function ensureAdmin(){
  const admin = get('SELECT * FROM admins WHERE username = ?', ['rikijspilka']);
  if (!admin) {
    const hash = await bcrypt.hash('pilkarikijs', 10);
    run('INSERT INTO admins (username, password_hash) VALUES (?, ?)', ['rikijspilka', hash]);
    console.log('Default admin created: rikijspilka');
  }
})();

// attach socket handlers
require('./socket')(io);

const PORT = +(process.env.PORT || 3000);
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
