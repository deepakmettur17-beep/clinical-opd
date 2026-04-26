exports.getSuggestions = async (req, res) => {
    const { complaint } = req.body;
  
    if (!complaint) {
      return res.status(400).json({ message: "Complaint required" });
    }
  
    const text = complaint.toLowerCase();
  
    let suggestions = {
      possibleDiagnoses: [],
      investigations: [],
      redFlags: []
    };
  
    // Fever logic
    if (text.includes("fever")) {
      suggestions.possibleDiagnoses.push(
        "Viral fever",
        "Typhoid",
        "Dengue",
        "Malaria"
      );
  
      suggestions.investigations.push(
        "CBC",
        "CRP",
        "Dengue NS1",
        "Malaria smear",
        "Widal"
      );
  
      suggestions.redFlags.push(
        "Persistent high fever > 5 days",
        "Bleeding",
        "Altered sensorium"
      );
    }
  
    // Chest pain logic
    if (text.includes("chest pain")) {
      suggestions.possibleDiagnoses.push(
        "Acute coronary syndrome",
        "Gastritis",
        "Costochondritis"
      );
  
      suggestions.investigations.push(
        "ECG",
        "Troponin",
        "Chest X-ray"
      );
  
      suggestions.redFlags.push(
        "Radiating pain",
        "Sweating",
        "Hypotension"
      );
    }
  
    // Abdominal pain logic
    if (text.includes("abdominal pain")) {
      suggestions.possibleDiagnoses.push(
        "Gastritis",
        "Appendicitis",
        "UTI"
      );
  
      suggestions.investigations.push(
        "Ultrasound abdomen",
        "Urine routine",
        "CBC"
      );
  
      suggestions.redFlags.push(
        "Rebound tenderness",
        "Severe guarding",
        "Persistent vomiting"
      );
    }
  
    res.json(suggestions);
  };
  


