const fs = require('fs');
const path = require('path');

const drugMasterPath = path.join(__dirname, '../data/drugMaster.json');

class DrugMasterService {
  constructor() {
    this.drugMaster = JSON.parse(fs.readFileSync(drugMasterPath, 'utf8'));
  }

  getGenericInfo(genericName) {
    return this.drugMaster.find(dm => dm.genericName.toLowerCase() === genericName.toLowerCase());
  }

  checkClassDuplication(prescribedGenerics, newGenericName) {
    const newDrug = this.getGenericInfo(newGenericName);
    if (!newDrug) return null;

    for (const existingGeneric of prescribedGenerics) {
      const existingDrug = this.getGenericInfo(existingGeneric);
      if (existingDrug && existingDrug.drugClass === newDrug.drugClass) {
        return `SAFETY ALERT: Duplicate Drug Class detected. Patient already on ${existingDrug.drugClass} (${existingGeneric}).`;
      }
    }
    return null;
  }

  getGenericByBrand(brandName) {
    const entry = this.drugMaster.find(dm => 
      dm.brands.some(b => b.name.toLowerCase() === brandName.toLowerCase())
    );
    return entry ? entry.genericName : null;
  }
}

module.exports = new DrugMasterService();



