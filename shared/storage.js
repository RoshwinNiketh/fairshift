/**
 * FairShift Local Demo Data Storage & Persistence Abstraction
 * 
 * Provides robust versioned browser persistence via localStorage with:
 * - Version tag & migration/recovery from corrupted JSON
 * - Full organization-level separation
 * - Check-in / check-out state preservation
 * - Safety report and supervisor resolution notes preservation
 * - Explicit demo data reset functionality
 * - Works in both browser environments and headless SSR/Node contexts
 */

import { INITIAL_DATA } from './seedData.js';
import { calculateDurationHours, calculateShiftEarnings, evaluateFatigueRisk } from './calculations.js';

export const STORAGE_KEY = 'fairshift_demo_state_v1';
export const STORAGE_VERSION = 1;

/**
 * Initializes or restores state from localStorage
 * Falls back safely to INITIAL_DATA if storage is empty, invalid, or unavailable.
 */
export function getStoredState() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...JSON.parse(JSON.stringify(INITIAL_DATA)), _version: STORAGE_VERSION };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = { ...JSON.parse(JSON.stringify(INITIAL_DATA)), _version: STORAGE_VERSION };
      saveStoredState(initial);
      return initial;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || parsed._version !== STORAGE_VERSION || !Array.isArray(parsed.organizations) || !Array.isArray(parsed.workers)) {
      console.warn('FairShift storage version mismatch or corrupted state. Resetting to verified initial seed.');
      const initial = { ...JSON.parse(JSON.stringify(INITIAL_DATA)), _version: STORAGE_VERSION };
      saveStoredState(initial);
      return initial;
    }

    return parsed;
  } catch (err) {
    console.error('Failed to parse FairShift local state. Recovering with initial seed data:', err);
    const initial = { ...JSON.parse(JSON.stringify(INITIAL_DATA)), _version: STORAGE_VERSION };
    saveStoredState(initial);
    return initial;
  }
}

/**
 * Safely persists entire application state
 */
export function saveStoredState(state) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const payload = {
      ...state,
      _version: STORAGE_VERSION,
      _lastUpdated: new Date().toISOString()
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.error('Failed to write to localStorage:', err);
  }
}

/**
 * Resets local demo state back to pristine INITIAL_DATA
 */
export function resetStoredState() {
  const initial = { ...JSON.parse(JSON.stringify(INITIAL_DATA)), _version: STORAGE_VERSION };
  saveStoredState(initial);
  return initial;
}

/**
 * Retrieves scoped data for a single organization
 */
export function getLocalOrgData(orgId, customState = null) {
  const state = customState || getStoredState();
  const org = state.organizations.find(o => o.id === orgId) || state.organizations[0];
  const workers = state.workers.filter(w => w.orgId === org.id);
  const shifts = state.shifts.filter(s => s.orgId === org.id);
  const reports = state.reports.filter(r => r.orgId === org.id);

  const fatigueAlerts = [];
  workers.forEach(w => {
    const wShifts = shifts.filter(s => s.workerId === w.id && s.endTime);
    const risk = evaluateFatigueRisk(wShifts, {
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

  return {
    organization: org,
    workers,
    shifts,
    reports,
    fatigueAlerts
  };
}

/**
 * Executes a worker Check-In in local state
 */
export function localCheckIn(workerId, orgId) {
  const state = getStoredState();
  const org = state.organizations.find(o => o.id === orgId);
  if (!org) throw new Error('Organization not found');

  const worker = state.workers.find(w => w.id === workerId);
  if (!worker) throw new Error('Worker not found');
  if (worker.orgId !== org.id) throw new Error('Worker does not belong to specified organization');
  if (worker.activeShiftId) throw new Error('Worker already has an active shift');

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

  state.shifts.unshift(newShift);
  worker.activeShiftId = newShift.id;

  saveStoredState(state);
  return { shift: newShift, worker, state };
}

/**
 * Executes a worker Check-Out in local state
 */
export function localCheckOut(workerId, notes = '') {
  const state = getStoredState();
  const worker = state.workers.find(w => w.id === workerId);
  if (!worker || !worker.activeShiftId) throw new Error('No active shift found for this worker');

  const shift = state.shifts.find(s => s.id === worker.activeShiftId);
  if (!shift) {
    worker.activeShiftId = null;
    saveStoredState(state);
    throw new Error('Active shift record not found');
  }

  const org = state.organizations.find(o => o.id === shift.orgId);
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
  if (notes) shift.notes = notes.trim().slice(0, 500);

  worker.activeShiftId = null;

  saveStoredState(state);
  return { shift, worker, earnings, state };
}

/**
 * Records a safety grievance in local state
 */
export function localSubmitReport(reportData) {
  const { workerId, orgId, category, severity, title, description } = reportData;
  const state = getStoredState();

  const org = state.organizations.find(o => o.id === orgId);
  if (!org) throw new Error('Organization not found');

  const worker = state.workers.find(w => w.id === workerId);
  if (!worker) throw new Error('Worker not found');
  if (worker.orgId !== org.id) throw new Error('Worker does not belong to specified organization');

  if (!title?.trim() || !description?.trim()) {
    throw new Error('Title and description are required');
  }

  const newReport = {
    id: `rep-${Date.now()}`,
    orgId: org.id,
    workerId: worker.id,
    workerName: worker.name,
    category: category || 'SAFETY_HAZARD',
    severity: severity || 'MEDIUM',
    title: title.trim().slice(0, 150),
    description: description.trim().slice(0, 2000),
    status: 'OPEN',
    submittedAt: new Date().toISOString(),
    resolutionNote: ''
  };

  state.reports.unshift(newReport);
  saveStoredState(state);
  return { report: newReport, state };
}

/**
 * Updates a safety report status and notes in local state
 */
export function localUpdateReportStatus(reportId, status, resolutionNote) {
  const state = getStoredState();
  const report = state.reports.find(r => r.id === reportId);
  if (!report) throw new Error('Report not found');

  if (status) {
    report.status = status;
    if (status === 'RESOLVED') {
      report.resolvedAt = new Date().toISOString();
    }
  }

  if (resolutionNote !== undefined) {
    report.resolutionNote = resolutionNote.trim().slice(0, 1000);
  }

  saveStoredState(state);
  return { report, state };
}
