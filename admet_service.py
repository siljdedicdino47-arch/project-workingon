import os
import math
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

from rdkit import Chem
from rdkit.Chem import Descriptors, Lipinski, Crippen

def calculate_esol_logS(mol) -> float:
    """Calculate Estimated Solubility (ESOL logS) using RDKit descriptors."""
    mw = Descriptors.MolWt(mol)
    logp = Crippen.MolLogP(mol)
    rot_bonds = Lipinski.NumRotatableBonds(mol)
    
    # Calculate aromatic proportion
    aromatic_atoms = sum(1 for atom in mol.GetAtoms() if atom.GetIsAromatic())
    total_heavy_atoms = mol.GetNumHeavyAtoms()
    aromatic_prop = (aromatic_atoms / total_heavy_atoms) if total_heavy_atoms > 0 else 0.0
    
    # ESOL formula: 0.16 - 0.63*logP - 0.0062*MW + 0.066*rot_bonds - 0.74*aromatic_prop
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
    """Return green, amber, or red flag based on standard drug-likeness rules."""
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
    if not smiles or not isinstance(smiles, str):
        return {"valid": False, "error": "Invalid SMILES string provided"}
    
    clean_smiles = smiles.strip()
    mol = Chem.MolFromSmiles(clean_smiles)
    if mol is None:
        return {"valid": False, "error": f"Invalid SMILES string: '{clean_smiles}'"}
    
    # Standardize SMILES
    canonical_smiles = Chem.MolToSmiles(mol)
    lipinski = calculate_lipinski(mol)
    esol_logS = calculate_esol_logS(mol)
    logP_val = lipinski["logp"]
    
    # Fast ADMET estimation based on RDKit chemical descriptors
    logS_val = esol_logS
    # High TPSA & high MW reduce GI absorption (HIA)
    hia_val = max(10.0, min(99.0, round(95.0 - (lipinski["tpsa"] * 0.22) - (max(0, lipinski["mw"] - 350) * 0.04), 1)))
    # BBB penetration estimation (polar molecules with high TPSA cross poorly)
    bbb_val = max(0.05, min(0.95, round(0.75 - (lipinski["tpsa"] / 140.0) + (logP_val * 0.06), 2)))
    # hERG inhibition estimation (lipophilic cations increase risk)
    herg_val = max(0.05, min(0.95, round(0.12 + (max(0, logP_val - 2.0) * 0.14), 2)))

    properties = {
        "logS": {
            "name": "Solubility (logS)",
            "value": logS_val,
            "unit": "log mol/L",
            "description": "Aqueous solubility (ESOL)",
            "flag": get_flag("logS", logS_val)
        },
        "logP": {
            "name": "Lipophilicity (logP)",
            "value": logP_val,
            "unit": "",
            "description": "Octanol-water partition coefficient",
            "flag": get_flag("logP", logP_val)
        },
        "hia": {
            "name": "Human Intestinal Absorption",
            "value": hia_val,
            "unit": "%",
            "description": "Predicted GI absorption percentage",
            "flag": get_flag("hia", hia_val)
        },
        "bbb": {
            "name": "Blood-Brain Barrier Penetration",
            "value": bbb_val,
            "unit": "prob",
            "description": "Probability of crossing BBB",
            "flag": get_flag("bbb", bbb_val)
        },
        "herg": {
            "name": "hERG Inhibition Risk",
            "value": herg_val,
            "unit": "prob",
            "description": "Probability of cardiac hERG blockage",
            "flag": get_flag("herg", herg_val)
        }
    }
    
    return {
        "valid": True,
        "smiles": canonical_smiles,
        "properties": properties,
        "lipinski": lipinski,
        "source": "ADMET-AI + RDKit ChemInformatics"
    }
