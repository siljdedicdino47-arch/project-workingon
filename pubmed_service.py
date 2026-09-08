import os
import httpx
import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Optional

NCBI_API_KEY = os.getenv("NCBI_API_KEY", "")

def search_pubmed_raw(query: str, max_results: int = 10) -> List[Dict[str, Any]]:
    """
    Search PubMed via E-utilities esearch + efetch.
    Returns list of dicts with title, authors, journal, year, pmid, abstract, url.
    """
    if not query or not query.strip():
        return []
    
    clean_query = query.strip()
    esearch_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
    params = {
        "db": "pubmed",
        "term": clean_query,
        "retmode": "json",
        "retmax": max_results
    }
    if NCBI_API_KEY:
        params["api_key"] = NCBI_API_KEY

    try:
        with httpx.Client(timeout=12.0) as client:
            resp = client.get(esearch_url, params=params)
            if resp.status_code != 200:
                print(f"[PubMedService] esearch status {resp.status_code}")
                return []
            
            data = resp.json()
            id_list = data.get("esearchresult", {}).get("idlist", [])
            if not id_list:
                return []
            
            efetch_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
            fetch_params = {
                "db": "pubmed",
                "id": ",".join(id_list),
                "retmode": "xml"
            }
            if NCBI_API_KEY:
                fetch_params["api_key"] = NCBI_API_KEY
            
            fetch_resp = client.get(efetch_url, params=fetch_params)
            if fetch_resp.status_code != 200:
                print(f"[PubMedService] efetch status {fetch_resp.status_code}")
                return []
            
            root = ET.fromstring(fetch_resp.content)
            articles = root.findall(".//PubmedArticle")
            results = []
            
            for article in articles:
                pmid = article.findtext(".//PMID") or ""
                title = article.findtext(".//ArticleTitle") or "Untitled Article"
                title = title.rstrip(".")
                
                # Extract Authors
                author_nodes = article.findall(".//AuthorList/Author")
                authors_list = []
                for a in author_nodes[:4]:
                    last = a.findtext("LastName") or ""
                    fore = a.findtext("ForeName") or a.findtext("Initials") or ""
                    if last:
                        authors_list.append(f"{last} {fore}".strip())
                if len(author_nodes) > 4:
                    authors_list.append("et al.")
                authors_str = ", ".join(authors_list) if authors_list else "Unknown Authors"
                
                # Extract Journal & Year
                journal = article.findtext(".//Journal/Title") or article.findtext(".//Journal/ISOAbbreviation") or "PubMed Journal"
                year = article.findtext(".//JournalIssue/PubDate/Year")
                if not year:
                    pub_date_str = article.findtext(".//JournalIssue/PubDate/MedlineDate") or ""
                    year = pub_date_str[:4] if len(pub_date_str) >= 4 and pub_date_str[:4].isdigit() else "N/A"
                
                # Extract Abstract
                abstract_texts = article.findall(".//Abstract/AbstractText")
                abstract = " ".join([elem.text for elem in abstract_texts if elem.text])
                if not abstract:
                    abstract = "No abstract available in PubMed entry."
                
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
        print(f"[PubMedService] Exception during PubMed search: {e}")
        return []
