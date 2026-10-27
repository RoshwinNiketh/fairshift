import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { INITIAL_DATA } from '../shared/seedData.js';
import { calculateDurationHours, calculateShiftEarnings, evaluateFatigueRisk } from '../shared/calculations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// In-memory application store initialized with seeded synthetic records
// DEMO NOTICE: All records are synthetic; no real personally identifiable information or authentication.
let db = JSON.parse(JSON.stringify(INITIAL_DATA));

// Valid enum sets for payload validation
const VALID_CATEGORIES = new Set([
  'SAFETY_HAZARD',
  'EQUIPMENT_ISSUE',
  'EXCESSIVE_FATIGUE',
  'CHEMICAL_EXPOSURE',
  'PAY_DISCREPANCY',
  'WORKPLACE_HARASSMENT'
]);

const VALID_SEVERITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const VALID_STATUSES = new Set(['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED']);

// Helper to find organization
const getOrg = (orgId) => db.organizations.find(o => o.id === orgId);

// API: Health / Ping with explicit architecture & disclaimer headers
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.1.0',
    sdgGoal: 'SDG 8: Decent Work and Economic Growth',
    storageMode: 'in-memory-synthetic-store',
    demoNotice: 'Demonstration environment only. Synthetic data without persistent PII.'
  });
});

// API: List organizations
app.get('/api/orgs', (req, res) => {
  res.json(db.organizations);
});

// API: Get organization data (scoped strictly to organization)
app.get('/api/org/:orgId/data', (req, res) => {
  const { orgId } = req.params;
  const org = getOrg(orgId);
  if (!org) {
    return res.status(404).json({ error: `Organization '${orgId}' not found.` });
  }

  const workers = db.workers.filter(w => w.orgId === org.id);
  const shifts = db.shifts.filter(s => s.orgId === org.id);
  const reports = db.reports.filter(r => r.orgId === org.id);

  // Compute fatigue alerts for workers in this organization
  const fatigueAlerts = [];
  workers.forEach(w => {
    const workerShifts = shifts.filter(s => s.workerId === w.id);
    const risk = evaluateFatigueRisk(workerShifts, {
      maxDailyHours: org.settings.maxDailyHoursThreshold,
      minRestHours: org.settings.minRestHoursThreshold,
      maxWeeklyHours: org.settings.maxWeeklyHoursThreshold
    });
    if (risk.hasWarning) {
      fatigueAlerts.push({
        workerId: w.id,
        workerName: w.name,
        role: w.role,
        riskLevel: risk.riskLevel,
        warnings: risk.warnings,
        totalHoursLast7Days: risk.totalHoursLast7Days
      });
    }
  });

  res.json({
    organization: org,
    workers,
    shifts,
    reports,
    fatigueAlerts
  });
});

// API: Worker Check In
app.post('/api/shifts/check-in', (req, res) => {
  const { workerId, orgId } = req.body;
  if (!workerId || !orgId) {
    return res.status(400).json({ error: 'Both workerId and orgId are required.' });
  }

  const org = getOrg(orgId);
  if (!org) {
    return res.status(404).json({ error: 'Organization not found.' });
  }

  const worker = db.workers.find(w => w.id === workerId);
  if (!worker) {
    return res.status(404).json({ error: 'Worker not found.' });
  }

  // Cross-org boundary validation
  if (worker.orgId !== org.id) {
    return res.status(400).json({ error: 'Worker does not belong to specified organization.' });
  }

  if (worker.activeShiftId) {
    return res.status(400).json({ error: 'Worker already has an active shift.' });
  }

  const newShift = {
    id: `sh-${Date.now()}`,
    orgId: org.id,
    workerId: worker.id,
    workerName: worker.name,
    startTime: new Date().toISOString(),
    endTime: null,
    hours: 0,
    hourlyRate: worker.hourlyRate || org.settings.defaultHourlyRate,
    standardHours: org.settings.standardDailyHours,
    regularHours: 0,
    overtimeHours: 0,
    regularPay: 0,
    overtimePay: 0,
    totalEstimatedEarnings: 0,
    notes: 'Live recorded shift'
  };

  db.shifts.unshift(newShift);
  worker.activeShiftId = newShift.id;

  res.status(201).json({ shift: newShift, worker });
});

// API: Worker Check Out
app.post('/api/shifts/check-out', (req, res) => {
  const { workerId, notes } = req.body;
  if (!workerId) {
    return res.status(400).json({ error: 'workerId is required.' });
  }

  const worker = db.workers.find(w => w.id === workerId);
  if (!worker || !worker.activeShiftId) {
    return res.status(400).json({ error: 'No active shift found for this worker.' });
  }

  const shift = db.shifts.find(s => s.id === worker.activeShiftId);
  if (!shift) {
    worker.activeShiftId = null;
    return res.status(404).json({ error: 'Active shift record not found.' });
  }

  const org = getOrg(shift.orgId);
  if (!org) {
    return res.status(500).json({ error: 'Associated organization record missing.' });
  }

  shift.endTime = new Date().toISOString();
  shift.hours = calculateDurationHours(shift.startTime, shift.endTime);

  const earnings = calculateShiftEarnings(
    shift.hours,
    shift.hourlyRate,
    org.settings.standardDailyHours,
    org.settings.overtimeMultiplier
  );

  shift.regularHours = earnings.regularHours;
  shift.overtimeHours = earnings.overtimeHours;
  shift.regularPay = earnings.regularPay;
  shift.overtimePay = earnings.overtimePay;
  shift.totalEstimatedEarnings = earnings.totalEstimatedEarnings;
  if (notes && typeof notes === 'string') {
    shift.notes = notes.trim().slice(0, 500);
  }

  worker.activeShiftId = null;

  res.json({ shift, worker, earnings });
});

// API: Submit Safety Concern / Grievance
app.post('/api/reports', (req, res) => {
  const { workerId, orgId, category, severity, title, description } = req.body;
  if (!workerId || !orgId || !title || !description) {
    return res.status(400).json({ error: 'workerId, orgId, title, and description are required.' });
  }

  const org = getOrg(orgId);
  if (!org) {
    return res.status(404).json({ error: 'Organization not found.' });
  }

  const worker = db.workers.find(w => w.id === workerId);
  if (!worker) {
    return res.status(404).json({ error: 'Worker not found.' });
  }

  // Cross-org validation
  if (worker.orgId !== org.id) {
    return res.status(400).json({ error: 'Worker does not belong to the specified organization.' });
  }

  // Enum validation
  const finalCategory = VALID_CATEGORIES.has(category) ? category : 'SAFETY_HAZARD';
  const finalSeverity = VALID_SEVERITIES.has(severity) ? severity : 'MEDIUM';

  const cleanTitle = String(title).trim().slice(0, 150);
  const cleanDescription = String(description).trim().slice(0, 2000);

  if (!cleanTitle || !cleanDescription) {
    return res.status(400).json({ error: 'Valid title and description cannot be empty strings.' });
  }

  const newReport = {
    id: `rep-${Date.now()}`,
    orgId: org.id,
    workerId: worker.id,
    workerName: worker.name,
    category: finalCategory,
    severity: finalSeverity,
    title: cleanTitle,
    description: cleanDescription,
    status: 'OPEN',
    submittedAt: new Date().toISOString(),
    resolutionNote: ''
  };

  db.reports.unshift(newReport);
  res.status(201).json(newReport);
});

// API: Update Safety Concern Status & Resolution
app.patch('/api/reports/:reportId', (req, res) => {
  const { reportId } = req.params;
  const { status, resolutionNote } = req.body;

  const report = db.reports.find(r => r.id === reportId);
  if (!report) {
    return res.status(404).json({ error: `Report '${reportId}' not found.` });
  }

  if (status) {
    if (!VALID_STATUSES.has(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(', ')}` });
    }
    report.status = status;
    if (status === 'RESOLVED') {
      report.resolvedAt = new Date().toISOString();
    }
  }

  if (resolutionNote !== undefined) {
    report.resolutionNote = String(resolutionNote).trim().slice(0, 1000);
  }

  res.json(report);
});

// API: Update Organization Configuration (Restricted to safe threshold fields)
app.patch('/api/org/:orgId/settings', (req, res) => {
  const { orgId } = req.params;
  const org = getOrg(orgId);
  if (!org) {
    return res.status(404).json({ error: 'Organization not found.' });
  }

  const allowedKeys = [
    'standardDailyHours',
    'overtimeMultiplier',
    'defaultHourlyRate',
    'maxDailyHoursThreshold',
    'minRestHoursThreshold',
    'maxWeeklyHoursThreshold'
  ];

  for (const key of allowedKeys) {
    if (typeof req.body[key] === 'number' && req.body[key] > 0) {
      org.settings[key] = req.body[key];
    }
  }

  res.json(org);
});

// Serve frontend in production
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Fallback to index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`FairShift production server listening on 0.0.0.0:${PORT}`);
});
