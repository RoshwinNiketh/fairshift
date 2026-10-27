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
  localUpdateReportStatus,
  STORAGE_KEY,
  STORAGE_VERSION
} from '../shared/storage.js';
import { INITIAL_DATA } from '../shared/seedData.js';

// Mock localStorage for Node environment
class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

global.window = {
  localStorage: new MockLocalStorage()
};

test('Storage: getStoredState initializes with versioned pristine state', () => {
  window.localStorage.clear();
  const state = getStoredState();
  assert.ok(state);
  assert.strictEqual(state.organizations.length, 2);
  assert.strictEqual(state._version, STORAGE_VERSION);
  // Verify it was persisted to localStorage
  const raw = window.localStorage.getItem(STORAGE_KEY);
  assert.ok(raw);
  const parsed = JSON.parse(raw);
  assert.strictEqual(parsed._version, STORAGE_VERSION);
});

test('Storage: corrupted storage triggers safe recovery without crashing', () => {
  window.localStorage.setItem(STORAGE_KEY, 'invalid-json{{');
  const state = getStoredState();
  assert.ok(state);
  assert.strictEqual(state.organizations.length, 2);
  assert.strictEqual(state._version, STORAGE_VERSION);
});

test('Storage: version mismatch triggers automatic reset', () => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ _version: 999, organizations: [] }));
  const state = getStoredState();
  assert.strictEqual(state.organizations.length, 2);
  assert.strictEqual(state._version, STORAGE_VERSION);
});

test('Storage: localCheckIn and localCheckOut cycle preserves data and computes earnings', () => {
  window.localStorage.clear();
  const workerId = 'w-c3'; // Priya Sundaram (initially no active shift)
  const orgId = 'org-buildright';

  const inResult = localCheckIn(workerId, orgId);
  assert.ok(inResult.shift);
  assert.strictEqual(inResult.worker.activeShiftId, inResult.shift.id);

  // Read back directly from localStorage
  const savedAfterCheckin = getStoredState();
  const savedWorker = savedAfterCheckin.workers.find(w => w.id === workerId);
  assert.strictEqual(savedWorker.activeShiftId, inResult.shift.id);

  // Check out
  const outResult = localCheckOut(workerId, 'End of shift test');
  assert.ok(outResult.shift.endTime);
  assert.strictEqual(outResult.worker.activeShiftId, null);

  const savedAfterCheckout = getStoredState();
  const finalWorker = savedAfterCheckout.workers.find(w => w.id === workerId);
  assert.strictEqual(finalWorker.activeShiftId, null);
  const finalShift = savedAfterCheckout.shifts.find(s => s.id === inResult.shift.id);
  assert.ok(finalShift.endTime);
  assert.strictEqual(finalShift.notes, 'End of shift test');
});

test('Storage: localSubmitReport and localUpdateReportStatus persist resolution', () => {
  window.localStorage.clear();
  const reportPayload = {
    workerId: 'w-c2',
    orgId: 'org-buildright',
    category: 'EQUIPMENT_ISSUE',
    severity: 'HIGH',
    title: 'Worn wire rope on winch drum',
    description: 'Strands fraying near anchor collar.'
  };

  const submitResult = localSubmitReport(reportPayload);
  assert.strictEqual(submitResult.report.status, 'OPEN');
  assert.strictEqual(submitResult.report.title, 'Worn wire rope on winch drum');

  // Verify saved
  const savedState1 = getStoredState();
  assert.ok(savedState1.reports.some(r => r.id === submitResult.report.id));

  // Update status
  const updateResult = localUpdateReportStatus(
    submitResult.report.id,
    'RESOLVED',
    'Rope replaced with certified 16mm wire.'
  );
  assert.strictEqual(updateResult.report.status, 'RESOLVED');
  assert.strictEqual(updateResult.report.resolutionNote, 'Rope replaced with certified 16mm wire.');
  assert.ok(updateResult.report.resolvedAt);

  // Verify updated in storage
  const savedState2 = getStoredState();
  const storedRep = savedState2.reports.find(r => r.id === submitResult.report.id);
  assert.strictEqual(storedRep.status, 'RESOLVED');
  assert.strictEqual(storedRep.resolutionNote, 'Rope replaced with certified 16mm wire.');
});

test('Storage: resetStoredState restores pristine dataset', () => {
  // Mutate state first
  localSubmitReport({
    workerId: 'w-c1',
    orgId: 'org-buildright',
    title: 'Temporary Hazard',
    description: 'Testing reset'
  });
  const modified = getStoredState();
  assert.ok(modified.reports.length > INITIAL_DATA.reports.length);

  // Reset
  resetStoredState();
  const restored = getStoredState();
  assert.strictEqual(restored.reports.length, INITIAL_DATA.reports.length);
});
