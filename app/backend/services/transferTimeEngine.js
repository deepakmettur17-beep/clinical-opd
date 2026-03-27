function calculateTransferTime(visit) {

    if (!visit.doorTime || !visit.transferOutTime) return visit;
  
    const door = new Date(visit.doorTime);
    const out = new Date(visit.transferOutTime);
  
    const diffMs = out.getTime() - door.getTime();
  
    if (diffMs < 0) {
      visit.doorToTransferMinutes = 0;
      return visit;
    }
  
    visit.doorToTransferMinutes = Math.round(diffMs / 60000);
  
    return visit;
  }
  
  module.exports = { calculateTransferTime };