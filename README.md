# HR_Connect
Full-stack web application designed to streamline human resource management for KMITL personnel. Developed as a senior project , this centralized platform offers a dual-channel AI chatbot via Web &amp; LINE and dynamic data visualization dashboards to enhance communication and administrative efficiency

![HR ASSISTANT](https://github.com/user-attachments/assets/140f55aa-f0f9-49fe-8d50-c098febd4602)

## 🌟 Key Features

*   **RAG-Powered AI Chatbot:** An intelligent chatbot integrated into both the web platform and LINE Official Account. It utilizes a Retrieval-Augmented Generation (RAG) architecture to accurately answer personnel inquiries based on internal documents.
*   **Human-in-the-Loop (HITL) Continuous Learning:** The system actively logs unanswered questions, allowing HR staff to review and append new knowledge (documents, FAQs, Static QA) to the database, ensuring continuous improvement of the chatbot's accuracy.
*   **Centralized HR Admin Portal:** A dedicated backend system for HR staff to perform CRUD operations on official documents, forms, FAQs, and news announcements.
*   **Personnel & Student Data Management:** Allows HR to securely manage detailed personnel records (e.g., royal decorations) and student statistics, categorized by academic and fiscal years.
*   **Interactive Data Dashboards:** Integrates Microsoft Power BI to provide HR administrators with analytical dashboards for visualizing personnel demographics, training statistics, and system usage metrics.
*   **Direct Staff Communication:** Features a built-in ticketing system enabling users to request direct communication with HR staff via the LINE application, complete with real-time status notifications.

## 💻 Tech Stack

### Frontend & Backend
*   **Framework:** Next.js (TypeScript) API
*   **Libraries:** React, Tailwind CSS, React Query

### AI & Large Language Models
*   **Embeddings:** Ollama BGE Embedding
*   **Orchestration:** LangChain
*   **Models:** Google AI Studio API (Gemini)

### Database & ORM
*   **Database:** PostgreSQL
*   **ORM:** Prisma ORM
*   **Extensions:** pgvector (for vector storage), pg_trgm

### External Integrations
*   **Messaging:** LINE Messaging API
*   **Frontend Integration:** LINE Front-end Framework (LIFF)

### Business Intelligence & Analytics
*   **Visualization:** Microsoft Power BI
*   **Analysis:** Data Analysis Expressions (DAX)

### Infrastructure & Deployment
*   **Containerization:** Docker, Docker Compose
*   **Networking:** Cloudflare Tunnel

### Document Extraction Libraries
*   `fs.readFile`, `d3-dsv`, `pdf-parse`, `mammoth`, `word-extractor`

## 🚀 Getting Started

1.  **Clone the repository** :
2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```
3.  **Set up environment variables** (`.env` file) for Database, LINE API, and Gemini API keys.
4.  **Run Docker Compose** to spin up PostgreSQL and Ollama containers:
    ```bash
    docker-compose up -d
    ```
5. Because this project uses an external Docker volume for persistent PostgreSQL data, you must create it manually before starting the services. Run the following command in your terminal:
    ```bash
    docker volume create 1c6b08f75b8e0c4a06bdbf7dea3c63d6ad6867d6722b5b75b0ce47daea590b38
    ```
6.    **Start the development server:**
    ```bash
    npm run dev
    # or
    yarn dev
    ```

## 📄 Documentation

*   [View Demo & Presentation] *https://canva.link/e7cggy2h9onuv8g*
*   [View Full Project Documentation] *https://drive.google.com/file/d/1HGUKUGD_P0DWWtkAbA8JiJShUpsavg6R/view?usp=drive_link*
