# Scafflix — ChemBrain AI Research Assistant

Scafflix is an AI research assistant for drug discovery scientists that performs **ADMET predictions** (solubility, lipophilicity, GI absorption, BBB penetration, hERG cardiac blockage risk + Lipinski Rule of 5) and **PubMed literature searches** with inline citations (`[1]`, `[2]`).

---

## 🚀 Files Included for Deployment

- `streamlit_app.py` — Complete standalone Streamlit app ready for Streamlit Community Cloud.
- `requirements.txt` — Python dependencies for GitHub and Streamlit Cloud.
- `backend/` — FastAPI Python backend server.
- `src/` — React + Vite + Tailwind CSS frontend interface.

---

## ☁️ Deploying to Streamlit Community Cloud

1. Create a repository on [GitHub](https://github.com/new).
2. Push this project to your repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Scafflix Streamlit App"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/scafflix.git
   git push -u origin main
   ```
3. Go to [share.streamlit.io](https://share.streamlit.io/) and log in with GitHub.
4. Click **New app**, select your repository, and set the **Main file path** to `streamlit_app.py`.
5. Under **Advanced settings > Secrets**, add your Anthropic API key:
   ```toml
   ANTHROPIC_API_KEY = "your_anthropic_api_key_here"
   ```
6. Click **Deploy**!

---

## 💻 Local Execution

### Option A: Streamlit
```bash
pip install -r requirements.txt
streamlit run streamlit_app.py
```

### Option B: FastAPI + React
1. Start FastAPI backend:
   ```bash
   python3 -m uvicorn backend.main:app --reload --port 8000
   ```
2. Start React frontend:
   ```bash
   npm install
   npm run dev
   ```
