import test from 'node:test';
import assert from 'node:assert';
import { ASSISTANT_PROMPTS, answerAssistantQuery } from '../shared/assistant.js';
import { INITIAL_DATA } from '../shared/seedData.js';

test('Assistant isolation: Context key changes cleanly isolate conversation state between workers', () => {
  const org = INITIAL_DATA.organizations[0];
  const w1 = INITIAL_DATA.workers.find(w => w.id === 'w-c1');
  const w2 = INITIAL_DATA.workers.find(w => w.id === 'w-c2');

  const contextW1 = { role: 'worker', lang: 'en', org, worker: w1, shifts: INITIAL_DATA.shifts, reports: INITIAL_DATA.reports };
  const contextW2 = { role: 'worker', lang: 'en', org, worker: w2, shifts: INITIAL_DATA.shifts, reports: INITIAL_DATA.reports };

  const answerW1 = answerAssistantQuery('earnings', contextW1);
  const answerW2 = answerAssistantQuery('earnings', contextW2);

  // W1 earned differently than W2 based on distinct shifts
  assert.notStrictEqual(answerW1.answer, answerW2.answer);
  assert.ok(answerW1.answer.includes(w1.name));
  assert.ok(answerW2.answer.includes(w2.name));
});

test('Assistant isolation: Switching between worker and employer returns role-appropriate intents', () => {
  const org = INITIAL_DATA.organizations[0];
  const w1 = INITIAL_DATA.workers[0];

  const workerContext = { role: 'worker', lang: 'en', org, worker: w1, shifts: INITIAL_DATA.shifts, reports: INITIAL_DATA.reports };
  const employerContext = { role: 'employer', lang: 'en', org, workers: INITIAL_DATA.workers, shifts: INITIAL_DATA.shifts, reports: INITIAL_DATA.reports };

  const workerResp = answerAssistantQuery('overtime', workerContext);
  assert.strictEqual(workerResp.intent, 'worker_overtime');
  assert.ok(workerResp.answer.includes('Under BuildRight Infrastructure Ltd\'s rules'));

  const employerResp = answerAssistantQuery('fatigue_overview', employerContext);
  assert.strictEqual(employerResp.intent, 'employer_fatigue_overview');
  assert.ok(employerResp.answer.includes('worker(s) currently trigger fatigue'));
});

test('Assistant isolation: Language toggle switches response language and maintains accuracy', () => {
  const org = INITIAL_DATA.organizations[0];
  const w1 = INITIAL_DATA.workers[0];

  const enContext = { role: 'worker', lang: 'en', org, worker: w1, shifts: INITIAL_DATA.shifts, reports: INITIAL_DATA.reports };
  const taContext = { role: 'worker', lang: 'ta', org, worker: w1, shifts: INITIAL_DATA.shifts, reports: INITIAL_DATA.reports };

  const enResp = answerAssistantQuery('reports', enContext);
  const taResp = answerAssistantQuery('reports', taContext);

  assert.strictEqual(enResp.intent, 'worker_reports');
  assert.strictEqual(taResp.intent, 'worker_reports');
  assert.ok(enResp.answer.includes('status of your'));
  assert.ok(taResp.answer.includes('புகார்களின் நிலை'));
});
