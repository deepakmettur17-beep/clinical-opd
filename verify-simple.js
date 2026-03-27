try {
  const pharmacyService = require('./app/backend/services/pharmacyService');
  const drugMasterService = require('./app/backend/services/drugMasterService');
  console.log("Services loaded successfully");
  
  const amaryl = pharmacyService.getBrandDetails('Amaryl');
  console.log("Amaryl Generic:", amaryl?.genericName);
  
  const classAlert = drugMasterService.checkClassDuplication(['Glimepiride'], 'Glimepiride');
  console.log("Class Alert:", classAlert);
} catch (e) {
  console.error("LOAD ERROR:", e);
}
