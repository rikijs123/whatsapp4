# two-friend-chat-verified-admin

Generate full runnable project per specification.

Overview
- Frontend: React (Vite) + TailwindCSS
- Backend: Node.js + Express
- Realtime: Socket.IO
- DB: SQLite (default) with option to switch to Postgres
- Auth: JWT + session cookies

Structure
- `server/` - Express app, Socket.IO, migrations, routes
- `client/` - Vite + React app (Admin UI, room UI)

Quick start
1. Install server dependencies and run migrations:

```bash
cd server
npm install
cp .env.example .env
# edit .env (set HOST, JWT_SECRET, optionally Twilio vars)
npm run migrate
npm run dev
```

2. Install client dependencies and run dev server:

```bash
cd client
npm install
npm run dev
```

Default admin
- username: `rikijspilka`
- password: `pilkarikijs`

API (important endpoints)
- `POST /create-room` -> { phone } returns `{ roomId, url }`
- `POST /send-otp` -> { phone }
- `POST /verify-otp` -> { phone, otp }
- `GET /r/:id` -> serves client room page
- `POST /admin/login` -> { username, password }
- `GET /admin/rooms` (admin JWT required)
- `POST /admin/rooms/:id/set-max` (admin JWT required)
- `POST /admin/whitelist` (admin JWT required)

Socket.IO events
- `join_room`, `leave_room`, `message_send`, `typing`, `presence_update`, `read_receipt`

Testing scenarios
- Create a room: send POST `/create-room` with your whitelisted phone. Copy returned URL.
- Open URL in two browsers/devices; connect using verified phones with OTP flow (`/send-otp` and `/verify-otp`).
- Send messages and verify presence, typing indicator, and read receipts.
- Admin: Login at `/admin` (or use client Admin Panel) and modify room `max_participants`, add/remove whitelist numbers, view active sessions and admin logs.

Privacy and Data Retention
- Collected data: phone numbers (whitelist and users), messages (text, media metadata), session metadata (IP, user agent, platform, connected_at), admin logs.
- Retention: kept until DB clean-up; implement retention policies in production (e.g., purge messages after X days).
- SMS content is sent via configured SMS provider (Twilio by example). OTPs are not logged in plaintext by default (only hashed).

Security notes
- The server uses `helmet` and `cors` middleware; use HTTPS in production (reverse proxy or deploy platform).
- Passwords hashed with `bcrypt`; prepared statements used through `better-sqlite3`.
- Rate limiting applied globally and for OTP endpoints. OTP brute-force protections included.

Generate full runnable project per specification.
