import React, { useState, useEffect, useRef } from "react";
import {
  ChatMessage,
  sendChatMessage,
  predictAdmetDirect,
  searchLiteratureDirect,
  checkHealth,
  AdmetResponse,
  ReferenceItem,
} from "./services/api";
import { AdmetCard } from "./components/AdmetCard";
import { LiteratureCard } from "./components/LiteratureCard";
import {
  Bot,
  User,
  Send,
  Sparkles,
  FlaskConical,
  BookOpen,
  RefreshCw,
  Server,
  Zap,
  ChevronRight,
  Info,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

const SAMPLE_MOLECULES = [
  { name: "Aspirin", smiles: "CC(=O)OC1=CC=CC=C1C(=O)O", tag: "Analgesic" },
  { name: "Caffeine", smiles: "CN1C=NC2=C1C(=O)N(C(=O)N2C)C", tag: "CNS Stimulant" },
  { name: "Ibuprofen", smiles: "CC(C)CC1=CC=C(C=C1)C(C)C(=O)O", tag: "NSAID" },
  { name: "Imatinib", smiles: "CC1=C(C=C(C=C1)NC(=O)C2=CC=C(C=C2)CN3CCN(CC3)C)NC4=NC=CC(=N4)C5=CN=CC=C5", tag: "Kinase Inhibitor" },
];

const SAMPLE_QUESTIONS = [
  "Predict ADMET properties for Aspirin: CC(=O)OC1=CC=CC=C1C(=O)O",
  "Is imatinib predicted to penetrate the blood-brain barrier?",
  "Search PubMed for the mechanism of action of imatinib in chronic myeloid leukemia.",
  "Predict ADMET for Caffeine: CN1C=NC2=C1C(=O)N(C(=O)N2C)C",
];

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-1",
      role: "assistant",
      content:
        "Hello! I'm **ChemBrain**, your AI research assistant for cheminformatics and drug discovery.\n\n" +
        "Ask me a chemistry question in plain English or paste a SMILES string. I call real tools mid-conversation (**ADMET Prediction** via RDKit/ADMET-AI & **Literature Search** via PubMed) instead of guessing.",
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

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setLoading(true);

    // Determine expected tool loading indicator
    if (text.toUpperCase().includes("SMILES") || text.includes("=") || text.includes("CC1=") || text.toLowerCase().includes("admet")) {
      setToolLoadingText("Running ADMET prediction…");
    } else if (text.toLowerCase().includes("pubmed") || text.toLowerCase().includes("search") || text.toLowerCase().includes("mechanism") || text.toLowerCase().includes("literature")) {
      setToolLoadingText("Searching PubMed…");
    } else {
      setToolLoadingText("ChemBrain analyzing prompt…");
    }

    try {
      const historyPayload = messages.map((m) => ({ role: m.role, content: m.content }));
      const chatRes = await sendChatMessage(text, historyPayload);

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: chatRes.response,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        toolUsed: chatRes.tool_used,
        admetData: chatRes.admet_data,
        literatureData: chatRes.literature_data,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `⚠️ **Error communicating with ChemBrain backend**: ${err.message || "Is FastAPI running on http://localhost:8000?"}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      setToolLoadingText(null);
    }
  };

  const handleDirectAdmet = async (smiles: string) => {
    if (loading) return;
    setInput("");
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: `Predict ADMET properties for SMILES: \`${smiles}\``,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setToolLoadingText("Running ADMET prediction…");

    try {
      const admetRes = await predictAdmetDirect(smiles);
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: `Calculated **ADMET predictions** and **Lipinski Rule of 5** for SMILES \`${smiles}\` [RDKit + ADMET-AI].`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        toolUsed: "admet",
        admetData: admetRes,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: `⚠️ **ADMET Prediction Error**: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setLoading(false);
      setToolLoadingText(null);
    }
  };

  const handleDirectPubMed = async (query: string) => {
    if (loading) return;
    setInput("");
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: `Search PubMed literature for: "${query}"`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setToolLoadingText("Searching PubMed…");

    try {
      const litRes = await searchLiteratureDirect(query);
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: litRes.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        toolUsed: "pubmed",
        literatureData: litRes.references,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: `⚠️ **PubMed Search Error**: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setLoading(false);
      setToolLoadingText(null);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans antialiased overflow-hidden">
      {/* Sidebar */}
      <aside className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col justify-between hidden md:flex">
        <div className="p-4 overflow-y-auto space-y-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-xl text-white shadow-lg shadow-indigo-500/20">
              <FlaskConical className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-slate-100 tracking-tight">Scafflix</h1>
              <p className="text-xs text-indigo-400 font-medium">ChemBrain AI Agent</p>
            </div>
          </div>

          {/* Connection Status */}
          <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                <Server className="w-3.5 h-3.5" /> FastAPI Backend
              </span>
              {serverStatus === "connected" ? (
                <span className="flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded text-[11px] border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" /> Online
                </span>
              ) : serverStatus === "offline" ? (
                <span className="flex items-center gap-1 text-rose-400 font-semibold bg-rose-500/10 px-2 py-0.5 rounded text-[11px] border border-rose-500/20">
                  <AlertCircle className="w-3 h-3" /> Offline
                </span>
              ) : (
                <span className="text-slate-400 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Checking...
                </span>
              )}
            </div>
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/80">
              <span className="text-slate-400">Claude Tool-Calling API</span>
              <span className={anthropicConfigured ? "text-cyan-400 font-semibold" : "text-amber-400 font-semibold"}>
                {anthropicConfigured ? "Enabled" : "Direct Mode"}
              </span>
            </div>
          </div>

          {/* Sample Molecules */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-indigo-400" /> Sample SMILES Presets
            </h3>
            <div className="space-y-2">
              {SAMPLE_MOLECULES.map((mol) => (
                <div
                  key={mol.name}
                  onClick={() => handleDirectAdmet(mol.smiles)}
                  className="group bg-slate-800/50 hover:bg-slate-800 p-2.5 rounded-lg border border-slate-700/50 hover:border-indigo-500/50 cursor-pointer transition flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300 transition">
                      {mol.name}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono truncate w-44">{mol.smiles}</div>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-medium border border-indigo-500/20 flex-shrink-0">
                    {mol.tag}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Preset Prompts */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-cyan-400" /> Research Prompts
            </h3>
            <div className="space-y-2">
              {SAMPLE_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(q)}
                  className="w-full text-left bg-slate-800/40 hover:bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/40 hover:border-cyan-500/40 text-xs text-slate-300 hover:text-cyan-200 transition flex items-center justify-between group"
                >
                  <span className="line-clamp-2">{q}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 flex-shrink-0 ml-1" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Scafflix Prototype v1.0</span>
          <span>RDKit + ADMET-AI + PubMed</span>
        </div>
      </aside>

      {/* Main Chat Interface */}
      <main className="flex-1 flex flex-col h-full bg-slate-950 relative">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-800 px-6 flex items-center justify-between bg-slate-900/60 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 md:hidden">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-100 flex items-center gap-2">
                ChemBrain Chat Assistant
                <span className="text-xs font-normal text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                  Tool-Calling Agent
                </span>
              </h2>
              <p className="text-xs text-slate-400">Grounding claims with real ADMET-AI & PubMed literature citations</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={verifyBackendHealth}
              className="p-2 text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 rounded-lg border border-slate-700/60 transition"
              title="Refresh connection"
            >
              <RefreshCw className={`w-4 h-4 ${serverStatus === "checking" ? "animate-spin" : ""}`} />
            </button>
          </div>
        </header>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 sm:gap-4 max-w-4xl ${msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`}
            >
              {/* Avatar */}
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md ${
                  msg.role === "user"
                    ? "bg-gradient-to-br from-cyan-500 to-blue-600 text-white"
                    : "bg-gradient-to-br from-indigo-600 to-violet-700 text-white"
                }`}
              >
                {msg.role === "user" ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
              </div>

              {/* Message Box */}
              <div className="flex-1 space-y-2 max-w-3xl">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-300">
                    {msg.role === "user" ? "You" : "ChemBrain"}
                  </span>
                  <span className="text-[10px] text-slate-500">{msg.timestamp}</span>
                  {msg.toolUsed && (
                    <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Tool: {msg.toolUsed === "admet" ? "ADMET Prediction" : "PubMed Search"}
                    </span>
                  )}
                </div>

                <div
                  className={`rounded-2xl p-4 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-cyan-600/20 text-cyan-50 border border-cyan-500/30 rounded-tr-none"
                      : "bg-slate-900/90 text-slate-200 border border-slate-800 rounded-tl-none shadow-sm"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {/* Render Structured Cards if attached */}
                  {msg.admetData && <AdmetCard data={msg.admetData} />}
                  {msg.literatureData && msg.literatureData.length > 0 && (
                    <LiteratureCard references={msg.literatureData} />
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Tool Loading State Indicator */}
          {loading && (
            <div className="flex gap-3 max-w-3xl mr-auto">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white flex items-center justify-center flex-shrink-0 animate-pulse">
                <Bot className="w-5 h-5" />
              </div>
              <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl rounded-tl-none p-4 flex items-center gap-3">
                <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
                <span className="text-xs font-semibold text-indigo-300">{toolLoadingText || "ChemBrain executing tool call…"}</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 sm:p-6 bg-slate-900/80 border-t border-slate-800 backdrop-blur-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="max-w-4xl mx-auto relative flex items-center"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste a SMILES string or ask a drug discovery question..."
              disabled={loading}
              className="w-full bg-slate-950 text-slate-100 placeholder-slate-500 text-sm rounded-xl px-4 py-3.5 pr-14 border border-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="absolute right-2 p-2 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="max-w-4xl mx-auto flex items-center justify-between mt-2 text-[11px] text-slate-500 px-1">
            <span>Try pasting SMILES like: <code className="text-indigo-400 font-mono">CC(=O)OC1=CC=CC=C1C(=O)O</code></span>
            <span className="hidden sm:inline">ChemBrain calls predict_admet & search_pubmed automatically</span>
          </div>
        </div>
      </main>
    </div>
  );
}
