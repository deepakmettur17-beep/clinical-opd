const fs = require('fs');
const path = require('path');

const drugMasterPath = path.join(__dirname, '../data/drugMaster.json');
const inventoryPath = path.join(__dirname, '../data/pharmacyInventory.json');

class PharmacyService {
  constructor() {
    this.drugMaster = JSON.parse(fs.readFileSync(drugMasterPath, 'utf8'));
    this.inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
    this.mappedInventory = [];
    this.sync();
  }

  sync() {
    this.mappedInventory = this.inventory.map(item => {
      const masterEntry = this.drugMaster.find(dm => 
        dm.brands.some(b => b.name.toLowerCase() === item.brand.toLowerCase())
      );

      if (masterEntry) {
        return {
          ...item,
          genericName: masterEntry.genericName,
          drugClass: masterEntry.drugClass,
          status: 'MAPPED',
          isSafeToPrescribe: true
        };
      } else {
        return {
          ...item,
          genericName: 'UNMAPPED',
          drugClass: 'UNKNOWN',
          status: 'UNMAPPED',
          isSafeToPrescribe: false
        };
      }
    });
  }

  getAvailableBrands(genericOrClass) {
    return this.mappedInventory.filter(item => 
      (item.genericName.toLowerCase() === genericOrClass.toLowerCase() || 
       item.drugClass.toLowerCase() === genericOrClass.toLowerCase()) &&
      item.isSafeToPrescribe &&
      item.stockCount > 0
    );
  }

  getBrandDetails(brandName) {
    return this.mappedInventory.find(item => item.brand.toLowerCase() === brandName.toLowerCase());
  }

  checkStock(brandName, strength) {
    const item = this.mappedInventory.find(i => 
      i.brand.toLowerCase() === brandName.toLowerCase() && i.strength === strength
    );
    return item ? item.stockCount : 0;
  }
}

module.exports = new PharmacyService();



