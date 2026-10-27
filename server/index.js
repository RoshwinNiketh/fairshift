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
let db = JSON.parse(JSON.stringify(INITIAL_DATA));

// Helper to find organization
const getOrg = (orgId) => db.organizations.find(o => o.id === orgId) || db.organizations[0];

// API: Health / Ping
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    sdgGoal: 'SDG 8: Decent Work and Economic Growth',
    storageMode: 'in-memory-synthetic-store'
  });
});

// API: Get initial or current state for an organization
app.get('/api/orgs', (req, res) => {
  res.json(db.organizations);
});

app.get('/api/org/:orgId/data', (req, res) => {
  const { orgId } = req.params;
  const org = getOrg(orgId);
  const workers = db.workers.filter(w => w.orgId === org.id);
  const shifts = db.shifts.filter(s => s.orgId === org.id);
  const reports = db.reports.filter(r => r.orgId === org.id);

  // Compute fatigue alerts for each worker
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
  const worker = db.workers.find(w => w.id === workerId);
  if (!worker) return res.status(404).json({ error: 'Worker not found' });
  if (worker.activeShiftId) return res.status(400).json({ error: 'Worker already has an active shift' });

  const org = getOrg(orgId || worker.orgId);
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
  const worker = db.workers.find(w => w.id === workerId);
  if (!worker || !worker.activeShiftId) {
    return res.status(400).json({ error: 'No active shift found for this worker' });
  }

  const shift = db.shifts.find(s => s.id === worker.activeShiftId);
  if (!shift) {
    worker.activeShiftId = null;
    return res.status(404).json({ error: 'Shift record not found' });
  }

  const org = getOrg(shift.orgId);
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
  if (notes) shift.notes = notes;

  worker.activeShiftId = null;

  res.json({ shift, worker, earnings });
});

// API: Submit Safety Concern / Grievance
app.post('/api/reports', (req, res) => {
  const { workerId, orgId, category, severity, title, description } = req.body;
  if (!workerId || !title || !description) {
    return res.status(400).json({ error: 'Worker ID, title, and description are required' });
  }

  const worker = db.workers.find(w => w.id === workerId);
  const org = getOrg(orgId || (worker ? worker.orgId : 'org-buildright'));

  const newReport = {
    id: `rep-${Date.now()}`,
    orgId: org.id,
    workerId: worker ? worker.id : workerId,
    workerName: worker ? worker.name : 'Registered Employee',
    category: category || 'SAFETY_HAZARD',
    severity: severity || 'MEDIUM',
    title: title.trim(),
    description: description.trim(),
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
  if (!report) return res.status(404).json({ error: 'Report not found' });

  if (status) report.status = status;
  if (resolutionNote !== undefined) report.resolutionNote = resolutionNote;
  if (status === 'RESOLVED') report.resolvedAt = new Date().toISOString();

  res.json(report);
});

// API: Update Organization Configuration
app.patch('/api/org/:orgId/settings', (req, res) => {
  const { orgId } = req.params;
  const org = db.organizations.find(o => o.id === orgId);
  if (!org) return res.status(404).json({ error: 'Organization not found' });

  org.settings = { ...org.settings, ...req.body };
  res.json(org);
});

// API: Reset to Seed Data
app.post('/api/reset-data', (req, res) => {
  db = JSON.parse(JSON.stringify(INITIAL_DATA));
  res.json({ message: 'Synthetic data reset successfully' });
});

// Serve frontend in production
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Fallback to index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`FairShift server running on port ${PORT} (0.0.0.0)`);
});
