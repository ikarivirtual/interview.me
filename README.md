# interview.me

AI-powered voice interview practice platform. Paste a job posting URL, get a realistic mock interview tailored to the role, and receive a detailed performance report with scored feedback.

Built for the [DigitalOcean Gradient AI Hackathon](https://dograduation.devpost.com/).

## Project Structure

```
interview.me/
├── frontend/       React + Vite + Tailwind CSS (voice UI)
├── backend/        Express + PostgreSQL + DO Gradient AI
├── .do/            App Platform deployment spec
└── package.json    npm workspaces root
```

## Getting Started

### Quick Start (Docker)

The fastest way to run the full stack — no Node.js or PostgreSQL setup needed.

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. Clone the repo and create a `.env` file in the project root:
```
DO_MODEL_ACCESS_KEY=your-key-from-digitalocean
SERPER_API_KEY=your-serper-key
JINA_API_KEY=
```
3. Run:
```bash
docker compose up --build
```
4. Open `http://localhost:8080`

### Manual Setup

#### Prerequisites
- Node.js 20+
- PostgreSQL (any recent version — 16, 17, or 18)
- [DigitalOcean Model Access Key](https://cloud.digitalocean.com/gen-ai/inference)

#### 1. Install PostgreSQL

**macOS (Homebrew):**
```bash
brew install postgresql
brew services start postgresql
```

**Ubuntu/Debian:**
```bash
sudo apt install postgresql
sudo systemctl start postgresql
```

#### 2. Create the database

```bash
createdb interviewme
```

#### 3. Install dependencies

```bash
npm install
```

#### 4. Configure environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:
```
DATABASE_URL=postgresql://your-username@localhost:5432/interviewme
DO_MODEL_ACCESS_KEY=your-key-from-digitalocean
PORT=3001

# Optional: Context enrichment APIs
SERPER_API_KEY=your-serper-key
JINA_API_KEY=your-jina-key
```

> To get a Model Access Key, go to [DigitalOcean GenAI Inference](https://cloud.digitalocean.com/gen-ai/inference) and create a key.

#### 5. Run

```bash
npm run dev
```

Frontend runs on `http://localhost:5173`, backend on `http://localhost:3001`. The Vite dev server proxies `/api` requests to the backend automatically. Database tables are created automatically on first startup.

## Scripts

| Command                  | Description                          |
| ------------------------ | ------------------------------------ |
| `npm run dev`            | Start frontend + backend concurrently |
| `npm run dev:frontend`   | Start frontend dev server only       |
| `npm run dev:backend`    | Start backend dev server only        |
| `npm run build:frontend` | Production build frontend            |
| `npm run build:backend`  | Production build backend             |

## How It Works

1. **Enter a job title or paste a job URL** on the landing page
2. **Context enrichment** runs automatically — scrapes the job posting (via Jina Reader), extracts requirements/tech stack (via LLM), and searches for real interview questions (via Serper)
3. **Voice interview** begins — the AI interviewer asks role-specific questions via text-to-speech, you respond via microphone. The mic auto-detects when you stop talking (2s silence)
4. **Real-time conversation** streamed via SSE from DigitalOcean Gradient AI (GLM-5)
5. **End the interview** to generate a detailed performance report with scores

## Context Enrichment

When a job URL is provided, the backend runs a two-phase enrichment pipeline:

- **Phase 1:** Fetches the job page via Jina Reader API and parses the company/title from the page metadata
- **Phase 2:** Runs in parallel — LLM extracts structured data (requirements, responsibilities, tech stack) while Serper searches for real interview questions and company culture info

The enriched data is injected into the interviewer's system prompt so questions are tailored to the specific role, not generic.

Enrichment is optional — if API keys are missing or services time out, the interview still works with whatever info was provided.

## Tech Stack

**Frontend:** React 19, Vite 8, TypeScript, Tailwind CSS v4, shadcn/ui, Motion, Web Speech API (STT/TTS)

**Backend:** Express 5, PostgreSQL, OpenAI SDK (DO Gradient compatible), Server-Sent Events

**AI:** DigitalOcean Gradient AI — `glm-5` for interview conversation, job data extraction, and report generation

**Enrichment:** Jina Reader API (job page scraping), Serper API (interview question search)

**Deployment:** DigitalOcean App Platform (static site + service + managed database)

## API Endpoints

| Method | Path                       | Description                              |
| ------ | -------------------------- | ---------------------------------------- |
| POST   | `/api/sessions`            | Create interview session with enrichment |
| GET    | `/api/sessions/:id`        | Get session + message history            |
| POST   | `/api/chat`                | Send message, stream AI response (SSE)   |
| POST   | `/api/sessions/:id/end`    | End session, trigger report generation   |
| GET    | `/api/sessions/:id/report` | Get report (200 ready, 202 generating)   |
