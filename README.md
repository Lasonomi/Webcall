# WebCall

## Stack
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS + Motion + shadcn-style UI
- **Backend:** Go + MySQL + WebSocket

## Frontend structure

```
frontend/src/
├── app/                 # App shell, router
├── components/
│   ├── ui/              # Button, Input, Avatar (shadcn-style)
│   └── layout/          # TopNav, BottomTicker
├── features/
│   ├── auth/            # Login, Register
│   ├── home/            # Home / DM layout
│   ├── server/          # Server channels + chat + members
│   └── settings/        # (settings UI lives in AppShell for now)
├── hooks/               # useAuth (Zustand)
├── lib/                 # cn, helpers
├── services/            # API client
├── styles/              # globals.css + design tokens
└── types/
```

## Run

```bash
cd backend && go run .

cd frontend
npm install
npm run dev
```

Optional: `VITE_API_URL=http://localhost:8080`
