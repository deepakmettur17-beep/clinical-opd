function generateAdvice(diagnosis, habits, history) {
  let lifestyleAdvice = [];
  let dietAdvice = [];
  let redFlagAdvice = [
    "Return immediately if symptoms worsen",
    "Seek emergency care if breathing difficulty, chest pain, or unconsciousness occurs"
  ];

  const diagUpper = diagnosis.toUpperCase();
  const hasDiabetes = history && (history.toLowerCase().includes('diabetes') || history.toLowerCase().includes('dm'));
  const hasHTN = history && (history.toLowerCase().includes('hypertension') || history.toLowerCase().includes('htn'));

  // Logic mapping
  if (diagUpper.includes("STEMI") || diagUpper.includes("CARDIAC") || diagUpper.includes("MYOCARDIAL")) {
    lifestyleAdvice.push("Stop smoking immediately");
    lifestyleAdvice.push("Regular walking 30 minutes daily (post-recovery)");
    lifestyleAdvice.push("Strict medication adherence");
    dietAdvice.push("Low salt diet");
    dietAdvice.push("Avoid oily and fried foods");
    dietAdvice.push("Increase fiber intake");
  } 
  else if (diagUpper.includes("BLEED") || diagUpper.includes("HEMORRHAGE")) {
    lifestyleAdvice.push("Avoid alcohol completely");
    lifestyleAdvice.push("Avoid NSAIDs and unprescribed painkillers");
    dietAdvice.push("Soft diet");
    dietAdvice.push("Avoid spicy food");
    dietAdvice.push("Avoid extremely hot beverages");
  }
  else if (diagUpper.includes("SEPSIS") || diagUpper.includes("INFECTION")) {
    lifestyleAdvice.push("Maintain strict personal hygiene");
    lifestyleAdvice.push("Adequate rest and hydration");
    dietAdvice.push("High protein diet to aid recovery");
    dietAdvice.push("Easily digestible, well-cooked foods");
  }
  else if (diagUpper.includes("STROKE")) {
    lifestyleAdvice.push("Strict blood pressure monitoring");
    lifestyleAdvice.push("Engage in prescribed physical rehabilitation");
    dietAdvice.push("Low salt, low cholesterol diet");
    dietAdvice.push("Dysphagia-safe diet if swallowing is impaired");
  }

  // Comorbidities constraints
  if (hasDiabetes) {
    if (!lifestyleAdvice.includes("Regular exercise")) lifestyleAdvice.push("Regular exercise (as tolerated)");
    if (!lifestyleAdvice.includes("Daily foot inspection")) lifestyleAdvice.push("Daily foot inspection");
    dietAdvice.push("Strict low sugar / diabetic diet");
  }
  if (hasHTN && !dietAdvice.includes("Low salt diet")) {
    dietAdvice.push("Low salt diet (< 2g/day)");
    lifestyleAdvice.push("Daily blood pressure monitoring");
  }

  // Base Fallback
  if (lifestyleAdvice.length === 0) {
    lifestyleAdvice.push("Follow up regularly as advised");
    lifestyleAdvice.push("Take prescribed medications on time");
  }
  if (dietAdvice.length === 0) {
    dietAdvice.push("Maintain a balanced, healthy diet");
    dietAdvice.push("Stay adequately hydrated");
  }

  // Max 5 points constraint
  lifestyleAdvice = lifestyleAdvice.slice(0, 5);
  dietAdvice = dietAdvice.slice(0, 5);

  return {
    lifestyleAdvice,
    dietAdvice,
    redFlagAdvice
  };
}

module.exports = { generateAdvice };