# Server (two-friend-chat)

## Install

```bash
cd server
npm install
```

Create `.env` from `.env.example`.

## Run

```bash
npm run migrate
npm run dev
```

The server runs on `PORT` (default 3000).

## Important endpoints

- `POST /api/rooms/create-room` -> create room (returns `url` and `roomId`)
- `POST /api/auth/send-otp` -> { phone }
- `POST /api/auth/verify-otp` -> { phone, otp }
- `POST /api/admin/login` -> { username, password }
- `GET /api/admin/rooms` (admin JWT required)
- Socket.IO events: `join_room`, `leave_room`, `message_send`, `typing`, `presence_update`, `read_receipt`

## DB

Migrations are in `migrations/init.sql` and a helper script `src/migrate.js` applies them.

## Notes

- Default admin created on startup: `rikijspilka` / `pilkarikijs`
- SMS is mocked by default; wire `SMS_PROVIDER` in `.env` to integrate a real provider.
