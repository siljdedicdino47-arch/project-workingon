import os
import json
import re
import math
import httpx
import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Optional

import streamlit as st

# Configure page layout and style
st.set_page_config(
    page_title="Scafflix — ChemBrain AI",
    page_icon="🧪",
    layout="wide",
    initial_sidebar_state="expanded",
)

os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

# Try importing RDKit
try:
    from rdkit import Chem
    from rdkit.Chem import Descriptors, Lipinski, Crippen
    RDKIT_AVAILABLE = True
except ImportError:
    RDKIT_AVAILABLE = False

# Try importing Anthropic
try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False


# ==========================================
# 1. ADMET & Lipinski Calculation Logic
# ==========================================

def calculate_esol_logS(mol) -> float:
    mw = Descriptors.MolWt(mol)
    logp = Crippen.MolLogP(mol)
    rot_bonds = Lipinski.NumRotatableBonds(mol)
    aromatic_atoms = sum(1 for atom in mol.GetAtoms() if atom.GetIsAromatic())
    total_heavy_atoms = mol.GetNumHeavyAtoms()
    aromatic_prop = (aromatic_atoms / total_heavy_atoms) if total_heavy_atoms > 0 else 0.0
    logS = 0.16 - (0.63 * logp) - (0.0062 * mw) + (0.066 * rot_bonds) - (0.74 * aromatic_prop)
    return round(logS, 2)

def calculate_lipinski(mol) -> dict:
    mw = float(Descriptors.MolWt(mol))
    hbd = int(Lipinski.NumHDonors(mol))
    hba = int(Lipinski.NumHAcceptors(mol))
    logp = float(Crippen.MolLogP(mol))
    tpsa = float(Descriptors.TPSA(mol))
    
    violations = 0
    if mw > 500: violations += 1
    if logp > 5.0: violations += 1
    if hbd > 5: violations += 1
    if hba > 10: violations += 1
    
    return {
        "mw": round(mw, 2),
        "hbd": hbd,
        "hba": hba,
        "logp": round(logp, 2),
        "tpsa": round(tpsa, 2),
        "violations": violations,
        "passes": violations <= 1
    }

def get_flag(prop_name: str, val: float) -> str:
    if prop_name == "logS":
        if val >= -4.0: return "green"
        elif val >= -6.0: return "amber"
        else: return "red"
    elif prop_name == "logP":
        if 0.0 <= val <= 3.0: return "green"
        elif -1.0 <= val <= 5.0: return "amber"
        else: return "red"
    elif prop_name == "hia":
        if val >= 80.0: return "green"
        elif val >= 30.0: return "amber"
        else: return "red"
    elif prop_name == "bbb":
        if val < 0.30: return "green"
        elif val < 0.65: return "amber"
        else: return "red"
    elif prop_name == "herg":
        if val < 0.30: return "green"
        elif val < 0.60: return "amber"
        else: return "red"
    return "amber"

def predict_admet(smiles: str) -> dict:
    if not RDKIT_AVAILABLE:
        return {"valid": False, "error": "RDKit library is not installed in the python environment."}
    
    if not smiles or not isinstance(smiles, str):
        return {"valid": False, "error": "Invalid SMILES string provided"}
    
    clean_smiles = smiles.strip()
    mol = Chem.MolFromSmiles(clean_smiles)
    if mol is None:
        return {"valid": False, "error": f"Invalid SMILES string: '{clean_smiles}'"}
    
    canonical_smiles = Chem.MolToSmiles(mol)
    lipinski = calculate_lipinski(mol)
    esol_logS = calculate_esol_logS(mol)
    logP_val = lipinski["logp"]
    
    logS_val = esol_logS
    hia_val = max(10.0, min(99.0, round(95.0 - (lipinski["tpsa"] * 0.22) - (max(0, lipinski["mw"] - 350) * 0.04), 1)))
    bbb_val = max(0.05, min(0.95, round(0.75 - (lipinski["tpsa"] / 140.0) + (logP_val * 0.06), 2)))
    herg_val = max(0.05, min(0.95, round(0.12 + (max(0, logP_val - 2.0) * 0.14), 2)))

    properties = {
        "logS": {"name": "Solubility (logS)", "value": logS_val, "unit": "log mol/L", "description": "Aqueous solubility (ESOL)", "flag": get_flag("logS", logS_val)},
        "logP": {"name": "Lipophilicity (logP)", "value": logP_val, "unit": "", "description": "Octanol-water partition coefficient", "flag": get_flag("logP", logP_val)},
        "hia": {"name": "Human Intestinal Absorption", "value": hia_val, "unit": "%", "description": "Predicted GI absorption percentage", "flag": get_flag("hia", hia_val)},
        "bbb": {"name": "Blood-Brain Barrier Penetration", "value": bbb_val, "unit": "prob", "description": "Probability of crossing BBB", "flag": get_flag("bbb", bbb_val)},
        "herg": {"name": "hERG Inhibition Risk", "value": herg_val, "unit": "prob", "description": "Probability of cardiac hERG blockage", "flag": get_flag("herg", herg_val)}
    }
    
    return {
        "valid": True,
        "smiles": canonical_smiles,
        "properties": properties,
        "lipinski": lipinski,
        "source": "RDKit + ADMET ChemInformatics"
    }


# ==========================================
# 2. PubMed Literature Retrieval
# ==========================================

def search_pubmed_raw(query: str, max_results: int = 10, ncbi_api_key: str = "") -> List[Dict[str, Any]]:
    if not query or not query.strip():
        return []
    
    esearch_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
    params = {"db": "pubmed", "term": query.strip(), "retmode": "json", "retmax": max_results}
    if ncbi_api_key:
        params["api_key"] = ncbi_api_key

    try:
        with httpx.Client(timeout=12.0) as client:
            resp = client.get(esearch_url, params=params)
            if resp.status_code != 200:
                return []
            
            data = resp.json()
            id_list = data.get("esearchresult", {}).get("idlist", [])
            if not id_list:
                return []
            
            efetch_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
            fetch_params = {"db": "pubmed", "id": ",".join(id_list), "retmode": "xml"}
            if ncbi_api_key:
                fetch_params["api_key"] = ncbi_api_key
            
            fetch_resp = client.get(efetch_url, params=fetch_params)
            if fetch_resp.status_code != 200:
                return []
            
            root = ET.fromstring(fetch_resp.content)
            articles = root.findall(".//PubmedArticle")
            results = []
            
            for article in articles:
                pmid = article.findtext(".//PMID") or ""
                title = (article.findtext(".//ArticleTitle") or "Untitled Article").rstrip(".")
                
                author_nodes = article.findall(".//AuthorList/Author")
                authors_list = []
                for a in author_nodes[:3]:
                    last = a.findtext("LastName") or ""
                    fore = a.findtext("ForeName") or a.findtext("Initials") or ""
                    if last: authors_list.append(f"{last} {fore}".strip())
                if len(author_nodes) > 3: authors_list.append("et al.")
                authors_str = ", ".join(authors_list) if authors_list else "Unknown Authors"
                
                journal = article.findtext(".//Journal/Title") or "PubMed Journal"
                year = article.findtext(".//JournalIssue/PubDate/Year") or "N/A"
                
                abstract_texts = article.findall(".//Abstract/AbstractText")
                abstract = " ".join([elem.text for elem in abstract_texts if elem.text]) or "No abstract available."
                url = f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/" if pmid else ""
                
                results.append({
                    "pmid": pmid,
                    "title": title,
                    "authors": authors_str,
                    "journal": journal,
                    "year": year,
                    "abstract": abstract,
                    "url": url
                })
            
            return results
    except Exception as e:
        st.error(f"PubMed search exception: {e}")
        return []


# ==========================================
# 3. ChemBrain System & Claude Tool Agent
# ==========================================

SYSTEM_PROMPT = """You are ChemBrain, an AI research assistant for drug discovery scientists.

GROUNDING RULES:
1. Every factual claim must be labeled: [PubMed: PMID XXXXXXXX], [Predicted: ADMET-AI], or [RDKit].
2. Never cite a paper you were not actually given in this conversation's tool results. If you don't have a real citation, say "based on general knowledge" instead of inventing one.
3. If uncertain, say so explicitly rather than guessing confidently.

TOOLS AVAILABLE:
- predict_admet(smiles): returns predicted ADMET properties for a molecule
- search_pubmed(query): retrieves real PubMed abstracts to answer literature questions
"""

TOOLS_DEFINITION = [
    {
        "name": "predict_admet",
        "description": "Validates a SMILES molecular string, computes Lipinski Rule of 5 properties with RDKit, and predicts ADMET properties.",
        "input_schema": {
            "type": "object",
            "properties": {"smiles": {"type": "string", "description": "SMILES chemical structure string"}},
            "required": ["smiles"]
        }
    },
    {
        "name": "search_pubmed",
        "description": "Searches NCBI PubMed for biomedical literature and returns paper titles, PMIDs, and abstracts.",
        "input_schema": {
            "type": "object",
            "properties": {"query": {"type": "string", "description": "Search query terms for PubMed"}},
            "required": ["query"]
        }
    }
]


# ==========================================
# 4. Streamlit UI Rendering Helpers
# ==========================================

def render_admet_card(data: dict):
    if not data or not data.get("valid"):
        return
    
    props = data["properties"]
    lip = data["lipinski"]
    
    st.markdown(f"### 🧬 ADMET & Drug-Likeness Profile: `{data.get('smiles')}`")
    
    # Lipinski Metrics
    col1, col2, col3, col4, col5 = st.columns(5)
    col1.metric("MW (≤500)", f"{lip['mw']} g/mol")
    col2.metric("LogP (≤5)", lip['logp'])
    col3.metric("HBD (≤5)", lip['hbd'])
    col4.metric("HBA (≤10)", lip['hba'])
    col5.metric("TPSA (≤140)", f"{lip['tpsa']} Å²")
    
    if lip['passes']:
        st.success("✅ **Lipinski Rule of 5**: PASSED")
    else:
        st.error(f"❌ **Lipinski Rule of 5**: FAILED ({lip['violations']} Violations)")
        
    st.markdown("#### Predicted ADMET Properties")
    for key, p in props.items():
        flag_color = "🟢" if p['flag'] == "green" else ("🟡" if p['flag'] == "amber" else "🔴")
        st.write(f"{flag_color} **{p['name']}**: `{p['value']} {p['unit']}` — *{p['description']}*")

def render_literature_card(references: list):
    if not references:
        return
    
    st.markdown(f"### 📚 PubMed References ({len(references)} papers)")
    for idx, ref in enumerate(references, 1):
        with st.expander(f"[{idx}] {ref['title']} ({ref['year']})"):
            st.markdown(f"**Authors**: {ref['authors']}")
            st.markdown(f"**Journal**: {ref['journal']} | **PMID**: [{ref['pmid']}]({ref['url']})")
            st.caption(ref['abstract'])


# ==========================================
# 5. Main Streamlit Layout
# ==========================================

def main():
    st.title("🧪 Scafflix — ChemBrain AI Assistant")
    st.caption("Drug discovery assistant with automated ADMET prediction & PubMed literature citations")
    
    # Safely read secrets — st.secrets raises if no secrets.toml exists at all,
    # which is the normal case for a local run with no key configured.
    def _get_secret(name: str) -> str:
        try:
            return st.secrets.get(name, "")
        except Exception:
            return ""

    # Sidebar Setup
    with st.sidebar:
        st.header("⚙️ Configuration")
        api_key_input = st.text_input(
            "Anthropic API Key (optional)",
            type="password",
            value=_get_secret("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_API_KEY", ""),
            help="Optional. Leave blank to run in Direct Tools Mode — ADMET prediction and "
                 "PubMed search still work fully, using RDKit and NCBI directly instead of "
                 "Claude. Add a key later for conversational synthesis and citation writeups. "
                 "Never commit a real key to source control — use environment variables or "
                 "st.secrets instead of hardcoding it here."
        )
        ncbi_key_input = st.text_input(
            "NCBI API Key (Optional)",
            type="password",
            value=_get_secret("NCBI_API_KEY") or os.getenv("NCBI_API_KEY", ""),
            help="Raises PubMed rate limit from 3/sec to 10/sec."
        )

        if not api_key_input:
            st.info("🔧 **Direct Tools Mode** — no Anthropic key set. ADMET prediction and "
                    "PubMed search run locally without an AI chat layer.")
        
        st.divider()
        st.subheader("💊 Sample SMILES Presets")
        samples = {
            "Aspirin": "CC(=O)OC1=CC=CC=C1C(=O)O",
            "Caffeine": "CN1C=NC2=C1C(=O)N(C(=O)N2C)C",
            "Ibuprofen": "CC(C)CC1=CC=C(C=C1)C(C)C(=O)O",
            "Imatinib": "CC1=C(C=C(C=C1)NC(=O)C2=CC=C(C=C2)CN3CCN(CC3)C)NC4=NC=CC(=N4)C5=CN=CC=C5"
        }
        for name, smiles in samples.items():
            if st.button(f"Analyze {name}", key=name, use_container_width=True):
                st.session_state["pending_prompt"] = f"Predict ADMET properties for {name}: `{smiles}`"
        
        st.divider()
        st.markdown("### 🔬 Quick Tools")
        quick_smiles = st.text_input("Direct ADMET SMILES:")
        if st.button("Run ADMET Prediction", use_container_width=True):
            if quick_smiles:
                st.session_state["pending_prompt"] = f"Predict ADMET properties for SMILES: `{quick_smiles}`"

    # Chat Session State
    if "messages" not in st.session_state:
        st.session_state["messages"] = [
            {
                "role": "assistant",
                "content": "Hello! I'm **ChemBrain**, your AI assistant for drug discovery.\n\n"
                           "Paste a SMILES string or ask a question in plain English. I'll execute **ADMET prediction** and **PubMed literature search** automatically with citations!"
            }
        ]

    # Render Chat History
    for msg in st.session_state["messages"]:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])
            if msg.get("admet_data"):
                render_admet_card(msg["admet_data"])
            if msg.get("literature_data"):
                render_literature_card(msg["literature_data"])

    # Handle pending prompt from sidebar button
    prompt = st.chat_input("Ask a chemistry question or paste a SMILES string...")
    if "pending_prompt" in st.session_state and st.session_state["pending_prompt"]:
        prompt = st.session_state.pop("pending_prompt")

    if prompt:
        st.session_state["messages"].append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        # Process Assistant Response
        with st.chat_message("assistant"):
            if not ANTHROPIC_AVAILABLE or not api_key_input:
                # Direct / Fallback Mode without Claude API key — no AI call is made at all,
                # so this path never sends anything to a third party except NCBI PubMed.
                with st.spinner("Processing query via local ChemBrain tools..."):
                    # Check for SMILES pattern (cap length to avoid pathological regex input)
                    smiles_match = re.search(r'`?([A-Za-z0-9@+\-\[\]\(\)\\\/=#$%]{1,200})`?', prompt[:500])
                    if smiles_match and any(c in prompt for c in ['=', '(', ')', '#']) and len(smiles_match.group(1)) > 3:
                        smiles = smiles_match.group(1)
                        admet_res = predict_admet(smiles)
                        if admet_res.get("valid"):
                            ans_text = f"Calculated ADMET predictions and Lipinski Rule of 5 for `{smiles}` [RDKit]."
                            st.markdown(ans_text)
                            render_admet_card(admet_res)
                            st.session_state["messages"].append({
                                "role": "assistant",
                                "content": ans_text,
                                "admet_data": admet_res
                            })
                            st.stop()
                    
                    # PubMed search fallback
                    pubmed_res = search_pubmed_raw(prompt, max_results=5, ncbi_api_key=ncbi_key_input)
                    if pubmed_res:
                        ans_text = f"Retrieved {len(pubmed_res)} PubMed articles for: \"{prompt}\""
                        st.markdown(ans_text)
                        render_literature_card(pubmed_res)
                        st.session_state["messages"].append({
                            "role": "assistant",
                            "content": ans_text,
                            "literature_data": pubmed_res
                        })
                        st.stop()
                    
                    ans_text = "Please enter an Anthropic API Key in the sidebar to enable conversational ChemBrain tool-calling!"
                    st.markdown(ans_text)
                    st.session_state["messages"].append({"role": "assistant", "content": ans_text})
            
            else:
                # Full Claude Tool-Calling Agent Loop
                client = anthropic.Anthropic(api_key=api_key_input)
                formatted_msgs = [{"role": m["role"], "content": m["content"]} for m in st.session_state["messages"][-15:]]
                
                tool_used = None
                admet_data = None
                literature_data = None
                
                with st.spinner("ChemBrain analyzing & executing tool calls..."):
                    try:
                        for _ in range(4):
                            response = client.messages.create(
                                model="claude-3-5-sonnet-20241022",
                                max_tokens=2048,
                                system=SYSTEM_PROMPT,
                                messages=formatted_msgs,
                                tools=TOOLS_DEFINITION
                            )
                            
                            if response.stop_reason == "tool_use":
                                tool_blocks = [b for b in response.content if b.type == "tool_use"]
                                formatted_msgs.append({"role": "assistant", "content": response.content})
                                tool_results = []
                                
                                for block in tool_blocks:
                                    if block.name == "predict_admet":
                                        st.info(f"⚙️ Running ADMET prediction for SMILES: `{block.input.get('smiles')}`")
                                        res = predict_admet(block.input.get("smiles", ""))
                                        admet_data = res
                                        tool_results.append({"type": "tool_result", "tool_use_id": block.id, "content": json.dumps(res)})
                                    elif block.name == "search_pubmed":
                                        st.info(f"🔍 Searching PubMed literature for query: \"{block.input.get('query')}\"")
                                        res = search_pubmed_raw(block.input.get("query", ""), max_results=10, ncbi_api_key=ncbi_key_input)
                                        literature_data = res
                                        tool_results.append({"type": "tool_result", "tool_use_id": block.id, "content": json.dumps(res)})
                                
                                formatted_msgs.append({"role": "user", "content": tool_results})
                            else:
                                final_text = "\n".join([b.text for b in response.content if hasattr(b, 'text')])
                                st.markdown(final_text)
                                if admet_data: render_admet_card(admet_data)
                                if literature_data: render_literature_card(literature_data)
                                
                                st.session_state["messages"].append({
                                    "role": "assistant",
                                    "content": final_text,
                                    "admet_data": admet_data,
                                    "literature_data": literature_data
                                })
                                break
                    except Exception as e:
                        err_text = f"⚠️ Error running ChemBrain agent: {e}"
                        st.error(err_text)
                        st.session_state["messages"].append({"role": "assistant", "content": err_text})

if __name__ == "__main__":
    main()
