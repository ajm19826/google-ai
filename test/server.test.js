import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/index.js';

async function withServer(app, run) {
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test('rejects empty or oversized questions before calling Gemini', async () => {
  let called = false;
  const app = createApp({ answerStream: async function* () { called = true; }, getRecommendations: async () => [] });
  await withServer(app, async base => {
    const response = await fetch(`${base}/api/answer`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: '  ' })
    });
    assert.equal(response.status, 400);
    assert.equal(called, false);
  });
});

test('streams answer text and returns generated follow-up questions', async () => {
  const app = createApp({
    answerStream: async function* (question, history) {
      assert.equal(question, 'Why do balloons float?');
      assert.equal(history.at(-1).content, 'What is helium?');
      yield 'Helium is lighter ';
      yield 'than the air around us.';
    },
    getRecommendations: async () => ['How long do balloons float?']
  });
  await withServer(app, async base => {
    const response = await fetch(`${base}/api/answer`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Why do balloons float?', history: [{ role: 'user', content: 'What is helium?' }] })
    });
    const body = await response.text();
    assert.match(body, /event: token/);
    assert.match(body, /Helium is lighter/);
    assert.match(body, /How long do balloons float/);
  });
});

test('returns a friendly event when the Gemini provider fails', async () => {
  const app = createApp({ answerStream: async function* () { throw new Error('provider details'); }, getRecommendations: async () => [] });
  await withServer(app, async base => {
    const response = await fetch(`${base}/api/answer`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: 'How do magnets work?' })
    });
    const body = await response.text();
    assert.match(body, /event: error/);
    assert.doesNotMatch(body, /provider details/);
  });
});

test('allows only configured browser origins to read API responses', async () => {
  const previousOrigin = process.env.CORS_ORIGIN;
  process.env.CORS_ORIGIN = 'https://owner.github.io';
  const app = createApp({ answerStream: async function* () {}, getRecommendations: async () => [] });
  try {
    await withServer(app, async base => {
      const allowed = await fetch(`${base}/api/health`, { headers: { Origin: 'https://owner.github.io' } });
      const denied = await fetch(`${base}/api/health`, { headers: { Origin: 'https://other.example' } });
      assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://owner.github.io');
      assert.equal(denied.headers.get('access-control-allow-origin'), null);
    });
  } finally {
    if (previousOrigin === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = previousOrigin;
  }
});