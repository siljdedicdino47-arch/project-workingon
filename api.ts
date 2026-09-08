const API_BASE_URL = "http://localhost:8000";

export interface AdmetProperty {
  name: string;
  value: number;
  unit: string;
  description: string;
  flag: "green" | "amber" | "red";
}

export interface LipinskiData {
  mw: number;
  hbd: number;
  hba: number;
  logp: number;
  tpsa: number;
  violations: number;
  passes: boolean;
}

export interface AdmetResponse {
  valid: boolean;
  smiles?: string;
  properties?: Record<string, AdmetProperty>;
  lipinski?: LipinskiData;
  source?: string;
  error?: string;
}

export interface ReferenceItem {
  title: string;
  authors: string;
  journal: string;
  year: string;
  pmid: string;
  url: string;
}

export interface LiteratureResponse {
  answer: string;
  references: ReferenceItem[];
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  toolUsed?: "admet" | "pubmed" | null;
  admetData?: AdmetResponse | null;
  literatureData?: ReferenceItem[] | null;
  loadingTool?: string | null;
}

export interface ChatResponse {
  response: string;
  tool_used: "admet" | "pubmed" | null;
  admet_data?: AdmetResponse | null;
  literature_data?: ReferenceItem[] | null;
}

export async function checkHealth(): Promise<{ status: string; anthropic_configured: boolean }> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    if (!res.ok) throw new Error("Health check failed");
    return await res.json();
  } catch (err) {
    return { status: "offline", anthropic_configured: false };
  }
}

export async function sendChatMessage(message: string, history: { role: string; content: string }[]): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to send chat message");
  }
  return await res.json();
}

export async function predictAdmetDirect(smiles: string): Promise<AdmetResponse> {
  const res = await fetch(`${API_BASE_URL}/admet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ smiles }),
  });
  const data = await res.json();
  if (!res.ok || !data.valid) {
    throw new Error(data.error || "Invalid SMILES string");
  }
  return data;
}

export async function searchLiteratureDirect(query: string): Promise<LiteratureResponse> {
  const res = await fetch(`${API_BASE_URL}/literature?q=${encodeURIComponent(query)}`);
  const data = await res.json();
  if (!res.ok && res.status !== 404) {
    throw new Error(data.error || "Failed to fetch PubMed literature");
  }
  return data;
}
