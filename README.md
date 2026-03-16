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

## ⚙️ Installation

### 1. Clone Repository

```bash
git clone https://github.com/your-username/studysync-ai.git
cd studysync-ai
```

---

### 2. Setup Backend

```
cd Backend

python -m venv venv
source venv/bin/activate
```

Install dependencies:

```
pip install -r ../requirements.txt
```

Create `.env` inside **Backend**:

```
GROQ_API_KEY=your_key
FIREBASE_API_KEY=your_key
```

Run backend server:

```
python main.py
```

---

### 3. Setup Frontend

```
cd Frontend
npm install
npm run dev
```

Create `.env` inside **Frontend**:

```
VITE_API_URL=http://localhost:8000
VITE_FIREBASE_API_KEY=your_key
```

---

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
