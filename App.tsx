import React, { useState, useEffect, useRef } from "react";
import {
  ChatMessage,
  sendChatMessage,
  predictAdmetDirect,
  checkHealth,
} from "./services/api";
import { AdmetCard } from "./components/AdmetCard";
import { LiteratureCard } from "./components/LiteratureCard";
import { Send } from "lucide-react";

const SAMPLE_MOLECULES = [
  { name: "Aspirin", smiles: "CC(=O)OC1=CC=CC=C1C(=O)O" },
  { name: "Caffeine", smiles: "CN1C=NC2=C1C(=O)N(C(=O)N2C)C" },
  { name: "Ibuprofen", smiles: "CC(C)CC1=CC=C(C=C1)C(C)C(=O)O" },
  { name: "Imatinib", smiles: "CC1=C(C=C(C=C1)NC(=O)C2=CC=C(C=C2)CN3CCN(CC3)C)NC4=NC=CC(=N4)C5=CN=CC=C5" },
];

const SAMPLE_QUESTIONS = [
  "Is imatinib predicted to cross the blood-brain barrier?",
  "Published KRAS G12C inhibitor scaffolds with selectivity vs G12D",
  "Mechanism of action of imatinib in chronic myeloid leukemia",
];

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-1",
      role: "assistant",
      content:
        "I'm ChemBrain. Paste a SMILES string for an ADMET readout, or ask a " +
        "literature question and I'll search PubMed and cite what I find.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [toolLoadingText, setToolLoadingText] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<"connected" | "offline" | "checking">("checking");
  const [anthropicConfigured, setAnthropicConfigured] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    verifyBackendHealth();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, toolLoadingText]);

  const verifyBackendHealth = async () => {
    setServerStatus("checking");
    const res = await checkHealth();
    if (res.status === "ok") {
      setServerStatus("connected");
      setAnthropicConfigured(res.anthropic_configured);
    } else {
      setServerStatus("offline");
    }
  };

  const timestamp = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: "user", content: text, timestamp: timestamp() }]);
    if (!textToSend) setInput("");
    setLoading(true);

    if (/[=#()]/.test(text) || text.toLowerCase().includes("admet")) {
      setToolLoadingText("Running ADMET prediction");
    } else {
      setToolLoadingText("Searching PubMed");
    }

    try {
      const historyPayload = messages.map((m) => ({ role: m.role, content: m.content }));
      const chatRes = await sendChatMessage(text, historyPayload);
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: chatRes.response,
          timestamp: timestamp(),
          toolUsed: chatRes.tool_used,
          admetData: chatRes.admet_data,
          literatureData: chatRes.literature_data,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `Couldn't reach the ChemBrain backend: ${err.message || "is FastAPI running on http://localhost:8000?"}`,
          timestamp: timestamp(),
        },
      ]);
    } finally {
      setLoading(false);
      setToolLoadingText(null);
    }
  };

  const handleDirectAdmet = async (smiles: string) => {
    if (loading) return;
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: "user", content: `Predict ADMET properties for \`${smiles}\``, timestamp: timestamp() },
    ]);
    setLoading(true);
    setToolLoadingText("Running ADMET prediction");
    try {
      const admetRes = await predictAdmetDirect(smiles);
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: `ADMET properties and Lipinski Rule of 5 for \`${smiles}\`.`,
          timestamp: timestamp(),
          toolUsed: "admet",
          admetData: admetRes,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { id: `assistant-${Date.now()}`, role: "assistant", content: `ADMET prediction failed: ${err.message}`, timestamp: timestamp() },
      ]);
    } finally {
      setLoading(false);
      setToolLoadingText(null);
    }
  };

  return (
    <div className="flex h-screen bg-paper text-ink font-sans">
      {/* Workbench rail */}
      <aside className="w-72 border-r border-line flex flex-col justify-between hidden md:flex">
        <div className="p-5 overflow-y-auto thin-scroll space-y-7">
          <div>
            <div className="text-[15px] font-semibold tracking-tight">Scafflix</div>
            <div className="text-xs text-ink-muted mt-0.5">Cheminformatics workbench</div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs pb-2 border-b border-line">
              <span className="text-ink-muted">Backend</span>
              <span className={serverStatus === "connected" ? "text-flag-good" : serverStatus === "offline" ? "text-flag-risk" : "text-ink-muted"}>
                {serverStatus === "connected" ? "connected" : serverStatus === "offline" ? "offline" : "checking…"}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs pt-2">
              <span className="text-ink-muted">ChemBrain mode</span>
              <span className={anthropicConfigured ? "text-accent" : "text-flag-warn"}>
                {anthropicConfigured ? "conversational" : "direct tools"}
              </span>
            </div>
          </div>

          <div>
            <div className="text-xs text-ink-muted mb-2">Compound library</div>
            <div className="space-y-px">
              {SAMPLE_MOLECULES.map((mol) => (
                <button
                  key={mol.name}
                  onClick={() => handleDirectAdmet(mol.smiles)}
                  className="w-full text-left px-2.5 py-2 border-l-2 border-transparent hover:border-accent hover:bg-accent-soft transition-colors rounded-sm"
                >
                  <div className="text-sm">{mol.name}</div>
                  <div className="text-[11px] text-ink-faint font-mono truncate">{mol.smiles}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs text-ink-muted mb-2">Research prompts</div>
            <div className="space-y-px">
              {SAMPLE_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(q)}
                  className="w-full text-left px-2.5 py-2 border-l-2 border-transparent hover:border-accent hover:bg-accent-soft transition-colors rounded-sm text-sm text-ink-muted hover:text-ink"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-line text-[11px] text-ink-faint">
          RDKit · ADMET-AI · PubMed E-utilities
        </div>
      </aside>

      {/* Console */}
      <main className="flex-1 flex flex-col h-full">
        <header className="h-14 border-b border-line px-6 flex items-center justify-between">
          <div className="text-sm">
            <span className="font-medium">ChemBrain</span>
            <span className="text-ink-faint ml-2">grounded ADMET + literature answers</span>
          </div>
          <button onClick={verifyBackendHealth} className="text-xs text-ink-muted hover:text-ink transition-colors">
            refresh
          </button>
        </header>

        <div className="flex-1 overflow-y-auto thin-scroll">
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
            {messages.map((msg) => (
              <div key={msg.id} className="entry-in border-l-2 pl-4" style={{ borderColor: msg.role === "user" ? "#D9DCD3" : "#3D6B63" }}>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-xs font-medium">{msg.role === "user" ? "You" : "ChemBrain"}</span>
                  <span className="text-[11px] text-ink-faint">{msg.timestamp}</span>
                  {msg.toolUsed && (
                    <span className="text-[11px] text-accent">· {msg.toolUsed === "admet" ? "ran ADMET prediction" : "searched PubMed"}</span>
                  )}
                </div>
                <div className="text-sm leading-relaxed whitespace-pre-wrap text-ink">{msg.content}</div>
                {msg.admetData && <AdmetCard data={msg.admetData} />}
                {msg.literatureData && msg.literatureData.length > 0 && <LiteratureCard references={msg.literatureData} />}
              </div>
            ))}

            {loading && (
              <div className="border-l-2 border-accent pl-4">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-xs font-medium">ChemBrain</span>
                </div>
                <div className="text-sm text-ink-muted">{toolLoadingText || "Thinking"}…</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="border-t border-line px-6 py-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="max-w-3xl mx-auto flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste a SMILES string or ask a research question"
              disabled={loading}
              className="flex-1 bg-surface border border-line rounded px-3.5 py-2.5 text-sm placeholder-ink-faint focus:outline-none focus:border-accent transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2.5 bg-ink text-paper rounded hover:bg-accent-strong transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
