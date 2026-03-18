<p align="center">
  <img src="assets/logo.png" alt="interview.me logo" width="600">
</p>

# interview.me

AI-powered voice interview practice platform. Paste a job posting URL, get a realistic mock interview tailored to the role, and receive a detailed performance report with scored feedback.

Built for the [DigitalOcean Gradient AI Hackathon](https://digitalocean.devpost.com).

## How It Works

```mermaid
%%{init: {'flowchart': {'htmlLabels': true, 'fontSize': 13}}}%%
flowchart LR
    A["Paste job URL"] --> B["Enrich context"]
    B --> C["Voice interview"]
    C --> D["Performance report"]

    B -.- B1["Scrape posting via Jina Reader
    Extract requirements, tech stack
    Search for real interview questions"]

    C -.- C1["AI interviewer asks 4-5 questions
    ElevenLabs streaming TTS + browser STT
    Responses streamed via SSE"]

    D -.- D1["LLM evaluates full transcript
    Scored feedback across 5 categories
    Question-by-question breakdown"]
```

### Under the hood

- **Context enrichment** — Jina Reader scrapes the job posting while Serper searches for past interview questions and company culture. An LLM extracts structured data (requirements, tech stack, seniority) and generates a role-specific interviewer persona. Deep enrichment continues in the background, pulling interview questions from Glassdoor/Blind snippets.
- **Interview runtime** — Each chat turn gets injected system messages: turn guidance (behavioral → technical → closing), candidate behavior detection (blocks hijacking or early farewells), and a hard brevity constraint (≤40 words) in the recency position. Per-turn token limits prevent mid-sentence truncation.
- **Voice loop** — Frontend state machine (`AI_SPEAKING → LISTENING → PROCESSING → AI_SPEAKING`). TTS uses ElevenLabs with streaming playback via MediaSource API — audio starts playing as chunks arrive rather than waiting for the full MP3. Falls back to browser Web Speech API when ElevenLabs is unavailable. STT uses browser Web Speech API.
- **Report** — Streamed on-demand via SSE. The LLM evaluates the transcript and outputs scored feedback with a question-by-question breakdown.

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
ELEVENLABS_API_KEY=your-elevenlabs-key
ELEVENLABS_VOICE_ID=your-voice-id
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
cp backend/.env.example .env
```

Edit `.env`:
```
DATABASE_URL=postgresql://your-username@localhost:5432/interviewme
DO_MODEL_ACCESS_KEY=your-key-from-digitalocean
PORT=3001

# Optional: Context enrichment APIs
SERPER_API_KEY=your-serper-key

# Optional: ElevenLabs TTS (falls back to browser speech synthesis if not set)
ELEVENLABS_API_KEY=your-elevenlabs-key
ELEVENLABS_VOICE_ID=your-voice-id
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

## Tech Stack

**Frontend:** React 19, Vite 8, TypeScript, Tailwind CSS v4, shadcn/ui, Motion, Web Speech API (STT), ElevenLabs streaming TTS

**Backend:** Express 5, PostgreSQL, OpenAI SDK (DO Gradient compatible), Server-Sent Events

**AI:** DigitalOcean Gradient AI — `minimax-m2.5` for interview conversation, prompt generation, and report generation; `openai-gpt-oss-120b` for brief generation and search query planning

**Enrichment:** Jina Reader API (job page scraping), Serper API (interview question search)

**Deployment:** DigitalOcean App Platform (static site + service + managed database)

## API Endpoints

| Method | Path                                  | Description                              |
| ------ | ------------------------------------- | ---------------------------------------- |
| POST   | `/api/sessions`                       | Create interview session with enrichment |
| GET    | `/api/sessions/:id`                   | Get session + message history            |
| POST   | `/api/chat`                           | Send message, stream AI response (SSE)   |
| POST   | `/api/sessions/:id/end`               | End session                              |
| GET    | `/api/sessions/:id/report/stream`     | Stream performance report (SSE)          |
| GET    | `/api/sessions/:id/report`            | Get report (200 ready, 202 generating)   |
| POST   | `/api/tts`                            | Text-to-speech via ElevenLabs (streamed) |
