# Client (two-friend-chat)

## Install

```bash
cd client
npm install
```

## Run

```bash
npm run dev
```

By default client expects API at `VITE_API_BASE` environment variable. You can set it in a `.env` file at client root, e.g.

```
VITE_API_BASE=http://localhost:3000
```

## Pages
- `/` — Generate link page
- `/r/:id` — Chat room UI
- `/admin` — Admin panel UI
