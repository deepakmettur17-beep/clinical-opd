const express = require("express");
const router = express.Router();
const Visit = require("../models/Visit");

router.get("/pci-monthly-report", async (req, res) => {
    try {
  
      const { year, month } = req.query;
  
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 1);
  
      const visits = await Visit.find({
        createdAt: { $gte: start, $lt: end },
        "cardiacEmergency.isSTEMI": true
      });
  
      // ðŸ‘‡ PASTE NEW KPI SPLIT BLOCK HERE
  
      // Local PCI (Cath lab present)
      const localPCI = visits.filter(v =>
        v.admissionPlan === "Immediate PCI" &&
        !v.requiresHigherCenter
      );
  
      const totalLocalPCI = localPCI.length;
  
      const onTimeLocalPCI = localPCI.filter(v =>
        v.dtbPerformanceFlag === "On Time (â‰¤90 min)"
      ).length;
  
      const localDTBValues = localPCI
        .map(v => v.doorToBalloonMinutes)
        .filter(v => v > 0);
  
      const avgLocalDTB = localDTBValues.length
        ? Math.round(localDTBValues.reduce((a,b)=>a+b,0)/localDTBValues.length)
        : 0;
  
      const localCompliancePercent = totalLocalPCI
        ? Math.round((onTimeLocalPCI / totalLocalPCI) * 100)
        : 0;
  
      // Transfers
      const transfers = visits.filter(v => v.requiresHigherCenter);
  
      const totalTransfers = transfers.length;
  
      const transferTimes = transfers
        .map(v => v.doorToTransferMinutes)
        .filter(v => v > 0);
  
      const avgDoorToTransfer = transferTimes.length
        ? Math.round(transferTimes.reduce((a,b)=>a+b,0)/transferTimes.length)
        : 0;
  
      const transferWithin30Min = transfers.filter(v =>
        v.doorToTransferMinutes > 0 &&
        v.doorToTransferMinutes <= 30
      ).length;
  
      const transferCompliancePercent = totalTransfers
        ? Math.round((transferWithin30Min / totalTransfers) * 100)
        : 0;
  
      // ðŸ‘‡ Then return JSON
      res.json({
        period: `${year}-${month}`,
        totalSTEMI: visits.length,
        primaryPCI: {
          totalLocalPCI,
          onTimeLocalPCI,
          avgLocalDTB,
          localCompliancePercent
        },
        transfers: {
          totalTransfers,
          avgDoorToTransfer,
          transferWithin30Min,
          transferCompliancePercent
        }
      });
  
    } catch (err) {
      res.status(500).json({ error: "Report generation failed" });
    }
  });

module.exports = router;

