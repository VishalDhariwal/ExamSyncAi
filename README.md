🚀 StudySync AI
Intelligent RAG-Based Exam Generation & Evaluation System

StudySync AI is an AI-powered platform that automatically generates exams from academic materials and evaluates student answers using Retrieval-Augmented Generation (RAG) and an agent-based AI workflow.

It helps students practice exams, receive instant feedback, and identify weak areas in their understanding.

✨ Features
📚 AI Exam Generation

Automatically generates syllabus-aligned exams using notes and previous year questions.

🧠 Agent-Based AI System

Modular AI pipeline separating retrieval, reasoning, generation, and evaluation.

📝 Auto Evaluation System

AI evaluates student answers and provides structured feedback and scoring.

🔍 Weakness Detection

Identifies weak topics and learning gaps after each exam.

👤 User System

Firebase authentication with persistent exam history tracking.

⚡ Semantic Search (RAG)

Uses vector embeddings for accurate context-based retrieval.

🧰 Tech Stack
Backend
Python
FastAPI
LangChain
LangGraph
Groq LLM
ChromaDB
Firebase Admin SDK
Frontend
React
Vite
Tailwind CSS
AI Architecture
Retrieval Augmented Generation (RAG)
Vector Embeddings
Agent-based workflows
Prompt engineering
📂 Project Structure
Backend/
│── Data/
│   ├── sem3/
│   │   ├── DBMS/
│   │   │   ├── NOTES/notes.txt
│   │   │   └── PYQ/*.txt
│   │   ├── DSA/
│   │   │   ├── NOTES/notes.txt
│   │   │   └── PYQ/*.txt
│   ├── sem4/
│
│── chroma_db/
│── firebase_key.json
│── main.py
│── src/
│   ├── graph.py
│   ├── state.py
│   ├── rag_setup.py
│   ├── retriever.py
│   ├── nodes/
│   └── firebase_config.py
│
Frontend/
│── src/
│   ├── api/api.js
│   ├── components/
│   ├── Pages/
│   ├── firebase/firebase.js
│
│── package.json
│── vite.config.js
🚀 Installation Guide
📦 1. Clone Repository
git clone https://github.com/your-username/studysync-ai.git
cd studysync-ai
🖥️ 2. Backend Setup
Step 1: Go to backend
cd Backend
Step 2: Create virtual environment
python -m venv venv

Activate it:

Mac/Linux

source venv/bin/activate

Windows

venv\Scripts\activate
Step 3: Install dependencies
pip install -r requirements.txt
Step 4: Setup environment variables

Create:

Backend/.env

Add:

GROQ_API_KEY=your_groq_api_key

FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_auth_domain
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_storage_bucket
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
FIREBASE_DATABASE_URL=your_database_url
Step 5: Run backend
uvicorn main:app_api --reload

Backend runs at:

http://localhost:8000
🌐 3. Frontend Setup
Step 1: Go to frontend
cd Frontend
Step 2: Install dependencies
npm install
Step 3: Setup environment variables

Create:

Frontend/.env

Add:

VITE_API_URL=http://localhost:8000

VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_DATABASE_URL=your_database_url
Step 4: Run frontend
npm run dev

Frontend runs at:

http://localhost:5173
🔄 System Workflow
Academic notes and PYQs are ingested into vector database
ChromaDB stores embeddings for semantic search
User selects semester and subject
Relevant context is retrieved using RAG
AI generates exam questions
Student submits answers
AI evaluates answers and generates feedback
Weak topics are identified automatically
📊 Project Highlights
⚡ 10+ active students using system
🧠 AI-generated exams from real syllabus
📈 Automatic grading + feedback system
🔍 Topic-wise weakness detection
🔒 Environment Security

Never commit:

.env
firebase_key.json
venv/
node_modules/
chroma_db/
📌 Future Improvements
Adaptive difficulty system
Teacher dashboard
Performance analytics graphs
Multi-subject expansion
Cloud deployment (Render/Vercel)
👨‍💻 Author

Built as an AI-powered academic assistant for automated exam generation and evaluation.

⭐ Support

If you like this project, please consider giving it a ⭐ on GitHub.
