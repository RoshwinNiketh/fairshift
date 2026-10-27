import test from 'node:test';
import assert from 'node:assert';
import {
  getStoredState,
  saveStoredState,
  resetStoredState,
  getLocalOrgData,
  localCheckIn,
  localCheckOut,
  localSubmitReport,
  localUpdateReportStatus
} from '../shared/storage.js';
import { answerAssistantQuery } from '../shared/assistant.js';

// Setup Mock DOM and localStorage to emulate real browser session
class BrowserSessionStorage {
  constructor() {
    this.store = {};
  }
  getItem(k) { return this.store[k] || null; }
  setItem(k, v) { this.store[k] = String(v); }
  removeItem(k) { delete this.store[k]; }
  clear() { this.store = {}; }
}

global.window = { localStorage: new BrowserSessionStorage() };

test('Mocked local demo flow: Check-in, Reload, Check-out, Grievance, Resolution, Assistant Isolation & Reset', async (t) => {
  // Step 0: Initial load
  await t.test('1. Load Worker Dashboard (BuildRight Construction)', () => {
    resetStoredState();
    const data = getLocalOrgData('org-buildright');
    assert.strictEqual(data.organization.name, 'BuildRight Infrastructure Ltd');
    assert.strictEqual(data.workers.length, 3);
    const w1 = data.workers.find(w => w.id === 'w-c1');
    assert.strictEqual(w1.name, 'Muthu Velan');
    assert.strictEqual(w1.activeShiftId, null);
  });

  // Step 1: Check in and reload
  let liveShiftId;
  await t.test('2. Worker Checks in & Session Reloads', () => {
    const { shift } = localCheckIn('w-c1', 'org-buildright');
    assert.ok(shift.id);
    liveShiftId = shift.id;

    // Simulate complete browser refresh: read back purely from window.localStorage
    const reloadedData = getLocalOrgData('org-buildright');
    const workerAfterReload = reloadedData.workers.find(w => w.id === 'w-c1');
    assert.strictEqual(workerAfterReload.activeShiftId, liveShiftId);
    const activeShift = reloadedData.shifts.find(s => s.id === liveShiftId);
    assert.ok(activeShift);
    assert.strictEqual(activeShift.endTime, null);
  });

  // Step 2: Check out and verify estimated earnings
  await t.test('3. Worker Checks out & Receives Itemized Pay Breakdown', () => {
    const { shift, earnings } = localCheckOut('w-c1', 'Finished basement pour');
    assert.ok(shift.endTime);
    assert.strictEqual(typeof earnings.totalEstimatedEarnings, 'number');
    assert.strictEqual(earnings.hourlyRate, 130);

    // Verify persisted after another refresh
    const reloaded = getLocalOrgData('org-buildright');
    const worker = reloaded.workers.find(w => w.id === 'w-c1');
    assert.strictEqual(worker.activeShiftId, null);
  });

  // Step 3: Worker submits a safety grievance
  let submittedReportId;
  await t.test('4. Worker submits safety grievance & verifies persistence across refresh', () => {
    const { report } = localSubmitReport({
      workerId: 'w-c1',
      orgId: 'org-buildright',
      category: 'SAFETY_HAZARD',
      severity: 'CRITICAL',
      title: 'Scaffold toe-board missing on Pier 4',
      description: 'Heavy vibrator motor could fall through deck opening.'
    });
    assert.strictEqual(report.status, 'OPEN');
    submittedReportId = report.id;

    // Verify persistence across browser reload
    const reloaded = getLocalOrgData('org-buildright');
    const persistedRep = reloaded.reports.find(r => r.id === submittedReportId);
    assert.ok(persistedRep);
    assert.strictEqual(persistedRep.status, 'OPEN');
  });

  // Step 4: Employer switches view, inspects, and resolves the grievance
  await t.test('5. Employer switches view, resolves report & worker sees updated resolution note', () => {
    const { report } = localUpdateReportStatus(
      submittedReportId,
      'RESOLVED',
      'Toe-board clamped and safety net installed by maintenance crew.'
    );
    assert.strictEqual(report.status, 'RESOLVED');

    // Worker switches back to Worker View
    const workerViewData = getLocalOrgData('org-buildright');
    const workerReport = workerViewData.reports.find(r => r.id === submittedReportId);
    assert.strictEqual(workerReport.status, 'RESOLVED');
    assert.strictEqual(workerReport.resolutionNote, 'Toe-board clamped and safety net installed by maintenance crew.');
    assert.ok(workerReport.resolvedAt);
  });

  // Step 5: Assistant context isolation across workers, orgs, roles and languages
  await t.test('6. Assistant context isolation test', () => {
    const state = getStoredState();
    const orgConst = state.organizations[0];
    const orgColl = state.organizations[1];
    const w1 = state.workers.find(w => w.id === 'w-c1'); // Muthu
    const w2 = state.workers.find(w => w.id === 'w-c2'); // Ramesh

    // Worker 1 vs Worker 2
    const ans1 = answerAssistantQuery('earnings', { role: 'worker', lang: 'en', org: orgConst, worker: w1, shifts: state.shifts, reports: state.reports });
    const ans2 = answerAssistantQuery('earnings', { role: 'worker', lang: 'en', org: orgConst, worker: w2, shifts: state.shifts, reports: state.reports });
    assert.ok(ans1.answer.includes('Muthu Velan'));
    assert.ok(ans2.answer.includes('Ramesh Kumar'));
    assert.notStrictEqual(ans1.answer, ans2.answer);

    // Construction vs College
    const constThresh = answerAssistantQuery('thresholds', { role: 'employer', lang: 'en', org: orgConst });
    const collThresh = answerAssistantQuery('thresholds', { role: 'employer', lang: 'en', org: orgColl });
    assert.ok(constThresh.answer.includes('8h'));
    assert.ok(collThresh.answer.includes('7.5h'));

    // English vs Tamil
    const enFatigue = answerAssistantQuery('fatigue', { role: 'worker', lang: 'en', org: orgConst, worker: w1, shifts: state.shifts, reports: state.reports });
    const taFatigue = answerAssistantQuery('fatigue', { role: 'worker', lang: 'ta', org: orgConst, worker: w1, shifts: state.shifts, reports: state.reports });
    assert.ok(enFatigue.answer.includes('Fatigue risk detected'));
    assert.ok(taFatigue.answer.includes('சோர்வு அபாயம்'));
  });

  // Step 6: Demo data reset
  await t.test('7. Reset Demo Data restores initial state', () => {
    resetStoredState();
    const resetData = getLocalOrgData('org-buildright');
    // Newly submitted report should no longer exist
    assert.strictEqual(resetData.reports.some(r => r.id === submittedReportId), false);
    assert.strictEqual(resetData.reports.length, 2);
  });
});
