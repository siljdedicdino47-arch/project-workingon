# Scafflix — ChemBrain

A cheminformatics workbench: paste a SMILES string for an ADMET readout, or ask
a research question and get an answer grounded in real PubMed citations.

Two front ends share one backend logic, at different stages of the same build:

- `streamlit_app.py` — the original single-file prototype. Fastest to run,
  fewer moving parts, fine for quick testing.
- `src/` + `backend/` — the real website (React + FastAPI). This is what you'd
  actually ship. Needs Node installed in addition to Python.

Neither needs an Anthropic API key to run. Without one, ADMET prediction and
PubMed search still work fully (RDKit + NCBI directly); the key only adds
Claude's conversational synthesis on top.

---

## Option A — Streamlit prototype

```bash
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
streamlit run streamlit_app.py
```

Opens automatically at **http://localhost:8501**. Leave the "Anthropic API
Key" field in the sidebar blank — you'll be in Direct Tools Mode.

## Option B — The real website (React + FastAPI)

Two servers run side by side: FastAPI serves the API, Vite serves the React
frontend and proxies requests to it in the browser.

**Terminal 1 — backend:**
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000
```
Confirm it's up: open http://localhost:8000/health — you should see
`{"status":"ok",...}`.

**Terminal 2 — frontend:**
```bash
npm install
npm run dev
```
Opens at **http://localhost:5173**. This is the actual site.

To add a key later: create a `.env` file in the project root (copy
`.env.example`) and set `ANTHROPIC_API_KEY=sk-ant-...`, then restart the
backend. Never commit `.env` — it's already in `.gitignore`.

---

## Testing from another device on your network (phone, tablet, another laptop)

By default both dev servers only answer on `localhost` — nothing outside your
laptop can reach them. To test from a phone on the same Wi-Fi:

1. Find your laptop's local IP (macOS: `ipconfig getifaddr en0`; Windows:
   `ipconfig` and look for IPv4 Address; Linux: `hostname -I`). It'll look
   like `192.168.1.42`.
2. Start Vite with `npm run dev -- --host` — it'll print a "Network" URL you
   can open on the other device.
3. Update `API_BASE_URL` in `src/services/api.ts` from `http://localhost:8000`
   to `http://<your-laptop-ip>:8000` so the phone's browser can reach the
   backend too, then restart `uvicorn --host 0.0.0.0 --port 8000` so it
   accepts connections from other devices, not just itself.
4. Your laptop's firewall may prompt to allow incoming connections the first
   time — allow it for the duration of testing, then you can revoke it.

This keeps everything on your local network — nothing is exposed to the
internet. If you ever want a real public URL to share with someone remote
(before you've deployed anywhere), a tool like `ngrok http 5173` or
`cloudflared tunnel` does that without any hosting setup, but treat that link
as temporary and don't leave a tunnel open when you're not using it.

---

## What's still a prototype, not production

No auth, no billing, no persistent database — conversation history resets on
refresh. That's intentional for this stage; see `scafflix_build_spec.md` for
what's deliberately out of scope until this loop is validated.
