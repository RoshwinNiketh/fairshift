import test from 'node:test';
import assert from 'node:assert';
import { answerAssistantQuery, ASSISTANT_PROMPTS } from '../shared/assistant.js';
import { INITIAL_DATA } from '../shared/seedData.js';

test('Worker assistant produces dynamic earnings based on selected worker', () => {
  const org = INITIAL_DATA.organizations[0]; // BuildRight
  const w1 = INITIAL_DATA.workers.find(w => w.id === 'w-c1'); // Muthu Velan
  const w2 = INITIAL_DATA.workers.find(w => w.id === 'w-c2'); // Ramesh Kumar

  const context1 = {
    role: 'worker',
    lang: 'en',
    org,
    worker: w1,
    shifts: INITIAL_DATA.shifts,
    reports: INITIAL_DATA.reports
  };

  const context2 = {
    role: 'worker',
    lang: 'en',
    org,
    worker: w2,
    shifts: INITIAL_DATA.shifts,
    reports: INITIAL_DATA.reports
  };

  const resp1 = answerAssistantQuery('earnings', context1);
  const resp2 = answerAssistantQuery('earnings', context2);

  assert.strictEqual(resp1.intent, 'worker_earnings');
  assert.strictEqual(resp2.intent, 'worker_earnings');
  // Check that the two workers produce distinctly different grounded answers
  assert.ok(resp1.answer.includes('Muthu Velan'));
  assert.ok(resp2.answer.includes('Ramesh Kumar'));
  assert.notStrictEqual(resp1.answer, resp2.answer);
  assert.ok(resp1.answer.includes(org.symbol));
});

test('Worker assistant correctly identifies fatigue warnings for fatigued worker', () => {
  const org = INITIAL_DATA.organizations[0];
  const w1 = INITIAL_DATA.workers.find(w => w.id === 'w-c1'); // Fatigued worker (11h shift + 10.5h shift with short rest)

  const context = {
    role: 'worker',
    lang: 'en',
    org,
    worker: w1,
    shifts: INITIAL_DATA.shifts,
    reports: INITIAL_DATA.reports
  };

  const resp = answerAssistantQuery('fatigue', context);
  assert.strictEqual(resp.intent, 'worker_fatigue');
  assert.ok(resp.answer.includes('Fatigue risk detected'));
  assert.ok(resp.answer.includes('Max 10h per day'));
});

test('Worker assistant in Tamil returns accurate native translation', () => {
  const org = INITIAL_DATA.organizations[0];
  const w1 = INITIAL_DATA.workers.find(w => w.id === 'w-c1');

  const context = {
    role: 'worker',
    lang: 'ta',
    org,
    worker: w1,
    shifts: INITIAL_DATA.shifts,
    reports: INITIAL_DATA.reports
  };

  const resp = answerAssistantQuery('overtime', context);
  assert.strictEqual(resp.intent, 'worker_overtime');
  assert.ok(resp.answer.includes('கூடுதல் பணியாக (OT)'));
  assert.ok(resp.answer.includes(org.settings.standardDailyHours.toString()));
});

test('Employer assistant identifies unresolved critical safety reports', () => {
  const org = INITIAL_DATA.organizations[0];

  const context = {
    role: 'employer',
    lang: 'en',
    org,
    workers: INITIAL_DATA.workers.filter(w => w.orgId === org.id),
    shifts: INITIAL_DATA.shifts,
    reports: INITIAL_DATA.reports
  };

  const resp = answerAssistantQuery('critical_reports', context);
  assert.strictEqual(resp.intent, 'employer_critical_reports');
  assert.ok(resp.answer.includes('CRITICAL'));
  assert.ok(resp.answer.includes('Missing safety toe-board'));
});

test('Employer assistant answers change when report status is resolved', () => {
  const org = INITIAL_DATA.organizations[0];
  // Deep clone reports and mark rep-301 as RESOLVED
  const modifiedReports = JSON.parse(JSON.stringify(INITIAL_DATA.reports));
  modifiedReports.forEach(r => { r.status = 'RESOLVED'; });

  const context = {
    role: 'employer',
    lang: 'en',
    org,
    workers: INITIAL_DATA.workers.filter(w => w.orgId === org.id),
    shifts: INITIAL_DATA.shifts,
    reports: modifiedReports
  };

  const resp = answerAssistantQuery('critical_reports', context);
  assert.strictEqual(resp.intent, 'employer_critical_reports');
  assert.ok(resp.answer.includes('zero') || resp.answer.includes('no unresolved'));
});

test('Cross-industry differentiation: Construction vs College Housekeeping', () => {
  const orgConst = INITIAL_DATA.organizations[0]; // BuildRight
  const orgColl = INITIAL_DATA.organizations[1];  // Apex College

  const respConst = answerAssistantQuery('thresholds', { role: 'employer', lang: 'en', org: orgConst });
  const respColl = answerAssistantQuery('thresholds', { role: 'employer', lang: 'en', org: orgColl });

  assert.ok(respConst.answer.includes('Standard Daily Shift: 8h'));
  assert.ok(respColl.answer.includes('Standard Daily Shift: 7.5h'));
  assert.notStrictEqual(respConst.answer, respColl.answer);
});

test('Fallback handling for out-of-scope or unverified questions without hallucination', () => {
  const context = {
    role: 'worker',
    lang: 'en',
    org: INITIAL_DATA.organizations[0],
    worker: INITIAL_DATA.workers[0],
    shifts: [],
    reports: []
  };

  const resp = answerAssistantQuery('What will the weather be tomorrow in London?', context);
  assert.strictEqual(resp.intent, 'fallback');
  assert.ok(resp.answer.includes('do not have sufficient verifiable data'));
});
