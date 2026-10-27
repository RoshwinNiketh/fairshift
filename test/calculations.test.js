import test from 'node:test';
import assert from 'node:assert';
import { calculateDurationHours, calculateShiftEarnings, evaluateFatigueRisk } from '../shared/calculations.js';

test('calculateDurationHours calculates correct hours', () => {
  const start = '2026-10-27T08:00:00Z';
  const end = '2026-10-27T16:30:00Z';
  const hours = calculateDurationHours(start, end);
  assert.strictEqual(hours, 8.5);
});

test('calculateDurationHours handles invalid or inverted dates', () => {
  assert.strictEqual(calculateDurationHours(null, null), 0);
  assert.strictEqual(calculateDurationHours('2026-10-27T10:00:00Z', '2026-10-27T08:00:00Z'), 0);
});

test('calculateShiftEarnings computes regular pay accurately without overtime', () => {
  const earnings = calculateShiftEarnings(8, 20, 8, 1.5);
  assert.strictEqual(earnings.regularHours, 8);
  assert.strictEqual(earnings.overtimeHours, 0);
  assert.strictEqual(earnings.regularPay, 160);
  assert.strictEqual(earnings.overtimePay, 0);
  assert.strictEqual(earnings.totalEstimatedEarnings, 160);
  assert.strictEqual(earnings.isOvertime, false);
});

test('calculateShiftEarnings computes overtime correctly beyond threshold', () => {
  const earnings = calculateShiftEarnings(10.5, 20, 8, 1.5);
  // 8 hrs @ 20 = 160
  // 2.5 hrs @ (20 * 1.5 = 30) = 75
  // Total = 235
  assert.strictEqual(earnings.regularHours, 8);
  assert.strictEqual(earnings.overtimeHours, 2.5);
  assert.strictEqual(earnings.regularPay, 160);
  assert.strictEqual(earnings.overtimeRate, 30);
  assert.strictEqual(earnings.overtimePay, 75);
  assert.strictEqual(earnings.totalEstimatedEarnings, 235);
  assert.strictEqual(earnings.isOvertime, true);
});

test('evaluateFatigueRisk triggers daily excessive hours warning', () => {
  const shifts = [
    { id: 's1', startTime: '2026-10-25T07:00:00Z', endTime: '2026-10-25T19:00:00Z', hours: 12 }
  ];
  const risk = evaluateFatigueRisk(shifts, { maxDailyHours: 10, minRestHours: 11 });
  assert.strictEqual(risk.hasWarning, true);
  assert.strictEqual(risk.warnings[0].type, 'EXCESSIVE_DAILY_HOURS');
});

test('evaluateFatigueRisk triggers insufficient rest warning between shifts', () => {
  const shifts = [
    { id: 's1', startTime: '2026-10-25T08:00:00Z', endTime: '2026-10-25T18:00:00Z', hours: 10 },
    { id: 's2', startTime: '2026-10-26T01:00:00Z', endTime: '2026-10-26T09:00:00Z', hours: 8 }
  ]; // Rest is only 7 hours between 18:00 and 01:00 (threshold is 11)
  const risk = evaluateFatigueRisk(shifts, { maxDailyHours: 10, minRestHours: 11 });
  assert.strictEqual(risk.hasWarning, true);
  const restWarning = risk.warnings.find(w => w.type === 'INSUFFICIENT_REST');
  assert.ok(restWarning);
  assert.strictEqual(restWarning.severity, 'CRITICAL');
});
