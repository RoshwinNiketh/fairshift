import test from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';

const TEST_PORT = 8999;
let serverProc;

test('Server functional API lifecycle test', async (t) => {
  await t.test('Start server on test port', async () => {
    serverProc = spawn('node', ['server/index.js'], {
      env: { ...process.env, PORT: TEST_PORT.toString() },
      cwd: process.cwd()
    });

    await new Promise((resolve, reject) => {
      serverProc.stdout.on('data', (d) => {
        if (d.toString().includes('listening')) resolve();
      });
      serverProc.stderr.on('data', (e) => {
        console.error('Server err:', e.toString());
      });
      setTimeout(resolve, 1500); // fallback timeout
    });
  });

  await t.test('GET /api/health returns valid status & synthetic notice', async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'healthy');
    assert.strictEqual(data.sdgGoal, 'SDG 8: Decent Work and Economic Growth');
    assert.ok(data.demoNotice);
  });

  await t.test('GET /api/org/org-buildright/data returns isolated construction records', async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/org/org-buildright/data`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.organization.id, 'org-buildright');
    assert.ok(data.workers.length > 0);
    assert.ok(data.shifts.length > 0);
    assert.ok(data.reports.length > 0);
    assert.ok(data.fatigueAlerts.length > 0);
  });

  await t.test('GET /api/org/org-apexcollege/data returns isolated college records', async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/org/org-apexcollege/data`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.organization.id, 'org-apexcollege');
    // Ensure no construction workers are leaked
    assert.ok(data.workers.every(w => w.orgId === 'org-apexcollege'));
  });

  await t.test('POST /api/shifts/check-in rejects invalid worker or cross-org mismatch', async () => {
    // Cross-org injection attempt
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/shifts/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerId: 'w-c1', orgId: 'org-apexcollege' })
    });
    assert.strictEqual(res.status, 400);
    const err = await res.json();
    assert.ok(err.error.includes('does not belong'));
  });

  await t.test('POST /api/reports submits report with validation', async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workerId: 'w-c1',
        orgId: 'org-buildright',
        category: 'SAFETY_HAZARD',
        severity: 'CRITICAL',
        title: 'Unanchored staging plank on lift #2',
        description: 'Vibration caused plank to drift over opening.'
      })
    });
    assert.strictEqual(res.status, 201);
    const rep = await res.json();
    assert.strictEqual(rep.status, 'OPEN');
    assert.strictEqual(rep.title, 'Unanchored staging plank on lift #2');

    // Test resolving this report
    const patchRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/reports/${rep.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'RESOLVED',
        resolutionNote: 'Plank clamped and inspect tag signed off.'
      })
    });
    assert.strictEqual(patchRes.status, 200);
    const resolved = await patchRes.json();
    assert.strictEqual(resolved.status, 'RESOLVED');
    assert.strictEqual(resolved.resolutionNote, 'Plank clamped and inspect tag signed off.');
    assert.ok(resolved.resolvedAt);
  });

  await t.test('POST /api/shifts/check-in and check-out full cycle', async () => {
    // w-c3 has no active shift
    const inRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/shifts/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerId: 'w-c3', orgId: 'org-buildright' })
    });
    assert.strictEqual(inRes.status, 201);

    const outRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/shifts/check-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerId: 'w-c3', notes: 'Completed shift safely' })
    });
    assert.strictEqual(outRes.status, 200);
    const outData = await outRes.json();
    assert.strictEqual(outData.shift.workerId, 'w-c3');
    assert.ok(outData.shift.endTime);
  });

  await t.test('Teardown server', () => {
    if (serverProc) serverProc.kill();
  });
});
