try {
  console.log("Attempting to load treatmentEngine...");
  const te = require('./app/backend/services/treatmentEngine');
  console.log("Load successful");
} catch (e) {
  console.log("ERROR MESSAGE:", e.message);
  console.log("ERROR STACK:", e.stack);
  if (e.code) console.log("ERROR CODE:", e.code);
}
