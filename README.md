# StudyPilot: AI Study Assistant (FastAPI + SQLite Stack)

StudyPilot is a production-ready, full-stack study assistant platform. It allows users to upload PDF textbooks, slides, or study notes from their system and chat with their materials using Retrieval-Augmented Generation (RAG). It also automatically compiles comprehensive study summaries, flashcard decks, countdown-timed quizzes, and weekly study plans from the uploaded materials.

---

## Zero-Prerequisites Architecture

* **Local SQLite Database**: Replaces MongoDB with a local file-based database (`study_pilot.db`) created automatically in your root folder. **No installation, server running, or configuration is required.**
* **Local Fallback Mode**: If a `GEMINI_API_KEY` is not provided in your `.env` file, the application automatically enters a **fully functional offline/local demo mode**. The RAG chat engine runs keyword-matching heuristics on your PDF chunks, and structured generators build mock flashcards, study schedules, notes, and timed quizzes. This allows you to test 100% of the application's features immediately!
* **Pure Python PDF Parsing**: Extracts text page-by-page using the pure-Python `pypdf` library, requiring no external system tools or C-libraries.
* **In-Memory Cosine Similarity**: Compares float embedding vectors inside the user session, keeping search speeds fast and under 10ms.

---

## Features Overview

* **PDF Upload from System**: Upload textbooks, slide decks, or lecture PDFs directly from your computer files via drag-and-drop or file browser selection.
* **Semantic Study Chat (RAG)**: Chat with your books! Scopes responses to a specific document or your entire library. Outputs stream in real-time with syntax-colored code boxes, markdown formatting, and citation cards showing exactly what page in what document the answer came from.
* **AI Summary Notes**: Summarizes chapters into comprehensive study guides complete with chapter summaries, key concepts, definitions, and exam hints. Includes a full markdown editor to customize notes.
* **Interactive Flashcards**: Build study cards and flag them as "learned" or "review" to monitor progress.
* **Timed Quizzes**: Practices MCQs, True/False, and Short Answer questions with live countdown timers, automated scoring, and tutor explanations.
* **Study Planner**: Generates personalized learning paths with weekly milestones, daily topics, and checklist tasks.
* **Analytics Center**: Track study hours, scores, and document stats using interactive SVG progress charts and bars.

---

## Folder Structure

```text
ai-study-assistant/
├── backend/
│   ├── app/
│   │   ├── config.py         # Loads environment configs
│   │   ├── database.py       # SQLite engine session builders
│   │   ├── models.py         # SQLAlchemy schemas (User, Document, Chunk, Chat, Notes, Flashcards, Quiz, StudyPlan)
│   │   ├── main.py           # FastAPI application root and routes registry
│   │   ├── routers/          # Route routers (auth, documents, chat, notes, flashcards, quiz, planner, analytics)
│   │   ├── services/         # PDF parser, Gemini API wrapper, vector similarity search
│   │   └── utils/            # Text chunk splitters
│   ├── .env                  # Configuration variables
│   ├── requirements.txt      # Python dependencies list
│   └── run.py                # Boot script helper
├── frontend/
│   ├── src/
│   │   ├── components/      # Sidebar / Top Navbar Shells
│   │   ├── context/         # Auth, Theme contexts
│   │   ├── pages/           # Views (Auth, Documents, Chat, Flashcards, Quiz, Notes, Planner, Analytics, Profile)
│   │   ├── utils/           # Axios interceptors configuration
│   │   ├── App.tsx          # Tab gateway and layout
│   │   └── index.css        # Foundational layouts, cards, and theme variables
│   ├── package.json
│   └── vite.config.ts
├── study_pilot.db            # Auto-generated SQLite database file
└── README.md
```

---

## Running the Webapp Locally

### 1. Backend Server Setup
1. In a terminal, navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Create your local config file:
   ```bash
   # Copy .env.example to .env
   copy .env.example .env
   ```
3. Open `.env` and configure your keys:
   * **Optional**: Add your `GEMINI_API_KEY` (obtained from [Google AI Studio](https://aistudio.google.com/)) to enable semantic AI. If left blank, local fallback mode handles completions!
4. Start the backend:
   ```bash
   venv\Scripts\python run.py
   ```
   The API server will boot on **`http://localhost:5000`** and automatically initialize `study_pilot.db`.

### 2. Frontend client Setup
1. Open a new terminal in the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Launch the Vite dev server:
   ```bash
   cmd /c npm run dev
   ```
3. Open **`http://localhost:5173/`** in your browser.

---

## How to Test and Upload PDFs from your System
1. On the login screen, click **Continue as Guest** to bypass registration.
2. Go to the **My Documents** tab.
3. Click **Browse Files** (or drag and drop a PDF file from your system explorer).
4. Wait a few seconds for the document status to transition to **Ready**.
5. Switch to the **AI Study Chat** or any generator page to start studying!
