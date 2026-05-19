# 🤖 Ojas Chat - Offline AI Chatbot Assistant

Ojas Chat is a secure, local, and fully offline AI-powered customer support chatbot and admin control center. Built using **FastAPI** on the backend and **React + Vite** on the frontend, it uses local matching algorithms and integrates with **Ollama** (`llama3`) to handle queries completely offline—ensuring 100% data privacy and zero API token costs.

---

## 🌟 Key Features

*   **Offline First**: Fully functional without any internet connection. Uses local Jaccard similarity matcher as a backup fallback if the backend or local LLM is offline.
*   **Local Generative AI**: Integrates with [Ollama](https://ollama.com/) running a local `llama3` model for contextual, dynamic query answers based on a trained FAQ database.
*   **Interactive Widget Simulator**: A mock client website containing a floating live chat widget to test the bot's behavior in real-time.
*   **Admin Control Center**:
    *   **FAQ Manager**: Train the bot by adding, editing, or deleting target Q&A pairs (FAQs).
    *   **Chat Logs**: View live and historical user chat transcripts in real-time.
*   **Secure SQLite Database**: Keeps all FAQ corpus and chat logs structured and stored locally.

---

## 📁 Repository Structure

```text
ai-chatbot/
├── backend/
│   ├── database.py       # SQLAlchemy Models & SQLite Database connection
│   ├── main.py           # FastAPI Application & Ollama Integration
│   ├── matcher.py        # Local Text Matcher (Jaccard similarity fallback)
│   ├── requirements.txt  # Python package dependencies
│   └── chatbot.db        # Local SQLite database (git-ignored)
├── frontend/
│   ├── src/
│   │   ├── App.jsx       # Main Dashboard UI & Simulator Widget
│   │   ├── App.css       # Neon Theme Styles
│   │   └── main.jsx
│   ├── package.json      # Node dependency registry
│   └── vite.config.js    # Vite environment config
└── .gitignore            # Consolidated Git exclusions
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your system:
*   [Python 3.8+](https://www.python.org/)
*   [Node.js (v18+)](https://nodejs.org/)
*   [Ollama](https://ollama.com/) (For local LLM response generation)

---

### 1. Local LLM Setup (Ollama)

To enable generative answers when direct FAQ matches are not found:

1.  Download and install **Ollama**.
2.  Start the Ollama server.
3.  Pull the default `llama3` model by running:
    ```bash
    ollama pull llama3
    ```

---

### 2. Backend Setup (FastAPI)

1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Create a Python virtual environment:
    ```bash
    python -m venv venv
    ```
3.  Activate the virtual environment:
    *   **Windows**:
        ```powershell
        .\venv\Scripts\activate
        ```
    *   **macOS/Linux**:
        ```bash
        source venv/bin/activate
        ```
4.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
5.  Start the FastAPI server:
    ```bash
    python main.py
    ```
    The backend server will run on [http://127.0.0.1:8000](http://127.0.0.1:8000).

---

### 3. Frontend Setup (React + Vite)

1.  Navigate to the frontend directory:
    ```bash
    cd ../frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```
    The frontend dashboard and widget simulator will be accessible at [http://localhost:5173](http://localhost:5173).

---

## 🔒 Security & Configuration

*   **Database**: All data is stored in the local SQLite file `backend/chatbot.db` which is git-ignored to prevent accidental exposure of chat logs or local corpus.
*   **Ollama Address**: By default, the API attempts connection to Ollama at `http://localhost:11434`. You can configure this in `backend/main.py`.
