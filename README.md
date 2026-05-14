# AI Web Agent Multi-Model System (Replit-friendly)

Full-stack system (React + Express) yang menggabungkan kemampuan multi-model:
- Smart Assistant (chat)
- Coding Expert (chat)
- Website Builder (chat)
- Debug Expert (chat)
- AI Agent Mode (workflow/actions berbasis rencana)

> Catatan: Eksekusi agent di `/api/execute` saat ini adalah **demo non-side-effect** (menghasilkan rencana & step plan). Sandbox eksekusi proyek nyata bisa ditambahkan pada iterasi berikutnya.

## Stack
- Server: Node.js + Express
- Frontend: React + Vite

## Folder
- `server/` backend
- `client/` frontend

## Setup
1) Copy environment
- buat `.env` dari `.env.example`

2) Install dependencies
```bash
npm install
npm --prefix client install
```

3) Jalankan dev server (server + client)
```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000

## Environment Variables
Isi di `.env`:
- `OPENAI_API_KEY` (untuk mode provider chatgpt)
- `OPENAI_MODEL` (default: gpt-4o-mini)
- `GEMINI_API_KEY` (untuk mode provider gemini)
- `GEMINI_MODEL` (default: gemini-1.5-pro)

## API
### `POST /api/chat`
Body:
```json
{
  "mode": "smart|coding|website|debug|agent",
  "provider": "auto|chatgpt|gemini",
  "task": "string",
  "context": {}
}
```
Response:
```json
{ "provider": "chatgpt|gemini", "output": "..." }
```

### `POST /api/execute`
Body:
```json
{
  "mode": "agent",
  "task": "string",
  "constraints": {}
}
```
Response:
```json
{ "plan": {"steps":[...]}, "execution": [] }
```

## Replit Run
Jika kamu upload ke Replit:
1) Pastikan `OPENAI_API_KEY`/`GEMINI_API_KEY` diisi di Replit Secrets
2) Pastikan start command pakai `npm install` lalu `npm run dev`

## Quick Test (curl)
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"mode":"smart","provider":"auto","task":"Buat ringkasan langkah membuat website landing page."}'
```

```bash
curl -X POST http://localhost:3000/api/execute \
  -H "Content-Type: application/json" \
  -d '{"mode":"agent","task":"Buat AI agent yang bisa merencanakan workflow coding."}'
```
