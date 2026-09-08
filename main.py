import os
import sys
from dotenv import load_dotenv

# Load .env variables
load_dotenv()

from fastapi import FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

from backend.admet_service import predict_admet
from backend.pubmed_service import search_pubmed_raw
from backend.chembrain import process_chat_message, synthesize_literature

app = FastAPI(
    title="Scafflix ChemBrain API",
    description="Backend API for Scafflix drug discovery AI with ADMET prediction & PubMed literature tools",
    version="1.0.0"
)

# Enable CORS for frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str = Field(..., example="Can you predict ADMET properties for Aspirin (CC(=O)OC1=CC=CC=C1C(=O)O)?")
    history: Optional[List[Dict[str, Any]]] = Field(default_factory=list)

class AdmetRequest(BaseModel):
    smiles: str = Field(..., example="CC(=O)OC1=CC=CC=C1C(=O)O")

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "Scafflix ChemBrain API",
        "anthropic_configured": bool(os.getenv("ANTHROPIC_API_KEY"))
    }

@app.post("/admet")
def admet_endpoint(payload: AdmetRequest, response: Response):
    smiles = payload.smiles.strip() if payload.smiles else ""
    if not smiles:
        response.status_code = status.HTTP_400_BAD_REQUEST
        return {"valid": False, "error": "SMILES string is required"}
    
    result = predict_admet(smiles)
    if not result.get("valid"):
        response.status_code = status.HTTP_400_BAD_REQUEST
        return {"valid": False, "error": result.get("error", "Invalid SMILES")}
    
    return result

@app.get("/literature")
def literature_endpoint(response: Response, q: str = Query(..., description="Research question or search term")):
    query = q.strip() if q else ""
    if not query:
        response.status_code = status.HTTP_400_BAD_REQUEST
        return {"error": "Query string 'q' is required"}
    
    articles = search_pubmed_raw(query, max_results=10)
    if not articles:
        response.status_code = status.HTTP_404_NOT_FOUND
        return {"error": "No PubMed results found", "answer": "No PubMed articles were found matching your query.", "references": []}
    
    answer_text = synthesize_literature(query, articles)
    
    # Format references list per spec: title, authors, journal, year, pmid, url
    references = [
        {
            "title": art["title"],
            "authors": art["authors"],
            "journal": art["journal"],
            "year": art["year"],
            "pmid": art["pmid"],
            "url": art["url"]
        }
        for art in articles
    ]
    
    return {
        "answer": answer_text,
        "references": references
    }

@app.post("/chat")
def chat_endpoint(payload: ChatRequest):
    message = payload.message.strip() if payload.message else ""
    if not message:
        raise HTTPException(status_code=400, detail="Message string is required")
    
    chat_result = process_chat_message(message, payload.history or [])
    return chat_result
