# StudySync AI – Intelligent RAG-Based Exam Generation & Evaluation System

StudySync AI is an AI-powered platform that generates exams from academic materials and automatically evaluates student answers using Retrieval-Augmented Generation (RAG) and an agent-based AI workflow.

The system helps students practice exams, receive instant feedback, and identify learning gaps.

---

## 🚀 Features

* **RAG-Based Exam Generation**
  Automatically generates syllabus-aligned exams using study materials and previous-year papers.

* **Agentic AI Workflow**
  Modular architecture separating retrieval, reasoning, and generation for reliable outputs.

* **Automated Answer Evaluation**
  Multi-step grading agent that evaluates answers and generates feedback.

* **Weakness Analysis**
  Identifies knowledge gaps and highlights areas for improvement.

* **Multi-User System**
  Authentication with persistent exam history.

* **Fast Semantic Retrieval**
  Uses vector search for accurate context retrieval.

---

## 🧠 Tech Stack

### Backend

* Python
* FastAPI
* LangChain
* LangGraph
* Groq LLM
* ChromaDB (Vector Database)
* Firebase Authentication

### Frontend

* React
* Vite
* TailwindCSS

### AI Architecture

* Retrieval Augmented Generation (RAG)
* Vector Embeddings
* Agent-Based Workflow
* Prompt Engineering

---

## 📂 Project Structure

```
.
├── Backend
│   ├── main.py
│   ├── routes
│   │   ├── auth.py
│   │   ├── exam.py
│   │   └── results.py
│   ├── src
│   │   ├── graph.py
│   │   ├── retriever.py
│   │   ├── rag_setup.py
│   │   └── nodes
│   ├── Data
│   └── chroma_db
│
├── Frontend
│   ├── src
│   │   ├── components
│   │   ├── Pages
│   │   ├── api
│   │   └── firebase
│   └── package.json
│
└── requirements.txt
```

---

🚀 Installation Guide
📦 1. Clone the Repository
git clone https://github.com/your-username/studysync-ai.git
cd studysync-ai
🖥️ 2. Backend Setup
Step 1: Move into backend folder
cd Backend
Step 2: Create virtual environment
python -m venv venv

Activate it:

Mac / Linux:
source venv/bin/activate
Windows:
venv\Scripts\activate
Step 3: Install dependencies

From root folder, run:

pip install -r requirements.txt
Step 4: Setup environment variables

Create a file:

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
Step 5: Run backend server
python main.py

Backend will start at:

http://localhost:8000
🌐 3. Frontend Setup
Step 1: Move into frontend folder
cd Frontend
Step 2: Install dependencies
npm install
Step 3: Setup environment variables

Create file:

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

Frontend will start at:

http://localhost:5173
## Final Result

Once both are running:

Backend → http://localhost:8000
Frontend → http://localhost:5173
## 🔄 System Workflow

1. Academic materials are ingested and converted into embeddings.
2. Embeddings are stored in ChromaDB.
3. When generating an exam, relevant content is retrieved using semantic search.
4. AI agents generate questions based on retrieved context.
5. Students answer the exam.
6. Evaluation agents grade responses and generate feedback.

---

## 📊 Current Usage

* Used by **10+ students**
* Generates AI-based exams from course materials
* Provides instant automated feedback and grading

---

## 🔒 Environment Variables

The project uses `.env` files which are ignored in `.gitignore`.

Backend:

```
Backend/.env
```

Frontend:

```
Frontend/.env
```

---

## 📌 Future Improvements

* Adaptive exam difficulty
* Instructor dashboard
* Detailed analytics
* Cloud deployment
* Multi-course support

---

## 👨‍💻 Author

AI-powered academic assistant designed to improve exam preparation using modern LLM workflows.

---

## ⭐ Support

If you like this project, consider starring the repository.
