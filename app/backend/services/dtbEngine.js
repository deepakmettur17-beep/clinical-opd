function calculateDTB(visit) {

    if (!visit.doorTime || !visit.balloonTime) return visit;
  
    const door = new Date(visit.doorTime);
    const balloon = new Date(visit.balloonTime);
  
    const diffMs = balloon.getTime() - door.getTime();
  
    if (diffMs < 0) {
      visit.doorToBalloonMinutes = 0;
      visit.dtbPerformanceFlag = "Invalid Time Sequence";
      return visit;
    }
  
    const minutes = Math.round(diffMs / 60000);
  
    visit.doorToBalloonMinutes = minutes;
  
    if (minutes <= 90) {
      visit.dtbPerformanceFlag = "On Time (â‰¤90 min)";
    } 
    else if (minutes <= 120) {
      visit.dtbPerformanceFlag = "Delayed (90â€“120 min)";
      visit.pciDelayAlert = true;
      visit.pciDelayLevel = "Moderate Delay";
      visit.pciAlertGeneratedAt = new Date();
    } 
    else {
      visit.dtbPerformanceFlag = "Critical Delay (>120 min)";
      visit.pciDelayAlert = true;
      visit.pciDelayLevel = "Severe Delay";
      visit.pciAlertGeneratedAt = new Date();
    }
  
    return visit;
  }
  
  module.exports = { calculateDTB };