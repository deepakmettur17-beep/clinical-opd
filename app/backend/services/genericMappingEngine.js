/**
 * Generic Mapping Engine
 * Maps Brand Names to Generic Names, Strengths, Classes, and Categories.
 */

const drugDictionary = {
  // Diabetes
  "Amaryl 1 mg": { generic: "Glimepiride", strength: "1 mg", class: "Sulfonylurea", category: "diabetes", fallback: "Glycomet" },
  "Amaryl 2 mg": { generic: "Glimepiride", strength: "2 mg", class: "Sulfonylurea", category: "diabetes" },
  "Glycomet 500 mg": { generic: "Metformin", strength: "500 mg", class: "Biguanide", category: "diabetes" },
  "Glycomet GP 1": { generic: "Glimepiride 1 mg + Metformin 500 mg", strength: "Combo", class: "Sulfonylurea + Biguanide", category: "diabetes" },
  
  // Cardiac / Hypertension
  "Rosuvas Gold 20": { generic: "Rosuvastatin 20 mg + Aspirin 75 mg + Clopidogrel 75 mg", strength: "Combo", class: "Statin + Antiplatelet", category: "cardiac" },
  "Telma 40": { generic: "Telmisartan", strength: "40 mg", class: "ARB", category: "hypertension" },
  "Amlong 5": { generic: "Amlodipine", strength: "5 mg", class: "CCB", category: "hypertension" },
  
  // Emergency / ICU (Existing support)
  "Aspirin": { generic: "Aspirin", strength: "325 mg", class: "Antiplatelet", category: "antiplatelets" },
  "Clopidogrel": { generic: "Clopidogrel", strength: "75 mg", class: "Antiplatelet", category: "antiplatelets" },
  "Ticagrelor": { generic: "Ticagrelor", strength: "90 mg", class: "Antiplatelet", category: "antiplatelets" },
  "Heparin": { generic: "Heparin", strength: "5000 IU", class: "Anticoagulant", category: "anticoagulants" },
  "Enoxaparin": { generic: "Enoxaparin", strength: "40 mg", class: "Anticoagulant", category: "anticoagulants" },
  "Piperacillin-Tazobactam": { generic: "Piperacillin + Tazobactam", strength: "4.5 g", class: "Antibiotic (Beta-lactam)", category: "antibiotics" },
  "Ceftriaxone": { generic: "Ceftriaxone", strength: "1 g", class: "Antibiotic (Cephalosporin)", category: "antibiotics" },
  "Meropenem": { generic: "Meropenem", strength: "1 g", class: "Antibiotic (Carbapenem)", category: "antibiotics" },
  "Adrenaline": { generic: "Epinephrine", strength: "1 mg", class: "Catecholamine", category: "emergency" },
  "Noradrenaline": { generic: "Norepinephrine", strength: "4 mg", class: "Vasopressor", category: "emergency" },
  "Atropine": { generic: "Atropine", strength: "0.6 mg", class: "Anticholinergic", category: "emergency" },
  "Alteplase": { generic: "rt-PA", strength: "50 mg", class: "Thrombolytic", category: "emergency" },
  "Tranexamic Acid": { generic: "TXA", strength: "500 mg", class: "Antifibrinolytic", category: "emergency" },
  "Hydrocortisone": { generic: "Hydrocortisone", strength: "100 mg", class: "Corticosteroid", category: "emergency" },
  "Pantoprazole": { generic: "Pantoprazole", strength: "40 mg", class: "PPI", category: "gi" },
  "NS": { generic: "Normal Saline", strength: "500 ml", class: "Isotonic Crystalloid", category: "fluids" },
  "RL": { generic: "Ringer's Lactate", strength: "500 ml", class: "Isotonic Crystalloid", category: "fluids" }
};

const getDrugDetails = (brandName) => {
  // Try exact match
  if (drugDictionary[brandName]) return drugDictionary[brandName];
  
  // Try fuzzy match (first word)
  const baseName = brandName.split(' ')[0];
  const match = Object.keys(drugDictionary).find(k => k.startsWith(baseName));
  return drugDictionary[match] || null;
};

const formatPrescription = (brandName, mode = "FULL") => {
  const details = getDrugDetails(brandName);
  if (!details) return brandName; // Fallback to brand only if not in dictionary

  if (mode === "SIMPLE") {
    return `${brandName} (${details.generic})`;
  }
  
  if (mode === "PATIENT") {
    const purposeMap = {
      diabetes: "Diabetes medicine",
      hypertension: "BP medicine",
      cardiac: "Heart medicine",
      emergency: "Critical medicine",
      antibiotics: "Infection medicine"
    };
    const purpose = purposeMap[details.category] || "Medicine";
    return `${purpose} (${details.generic})`;
  }

  // DEFAULT: FULL MODE
  return `${brandName} (${details.generic} ${details.strength} – ${details.class})`;
};

module.exports = { getDrugDetails, formatPrescription };
