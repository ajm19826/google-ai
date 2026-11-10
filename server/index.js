import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { recommendQuestions, streamAnswer } from './gemini.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(root, '..');

function normalizeHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-12).flatMap(turn => {
    if (!turn || !['user', 'assistant'].includes(turn.role) || typeof turn.content !== 'string') return [];
    return [{ role: turn.role, content: turn.content.slice(0, 4000) }];
  });
}

export function createApp({ answerStream = streamAnswer, getRecommendations = recommendQuestions } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: '32kb' }));
  const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map(origin => origin.trim()).filter(Boolean);
  app.use('/api', cors({
    origin(origin, callback) {
      callback(null, !origin || allowedOrigins.includes(origin));
    }
  }));
  app.use('/api/', rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false }));

  app.post('/api/answer', async (request, response) => {
    const question = typeof request.body?.question === 'string' ? request.body.question.trim() : '';
    if (!question || question.length > 1000) {
      return response.status(400).json({ error: 'Please enter a question under 1,000 characters.' });
    }

    const history = normalizeHistory(request.body?.history);
    response.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    response.flushHeaders();
    const send = (event, data) => response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    try {
      let answer = '';
      for await (const text of answerStream(question, history)) {
        answer += text;
        send('token', { text });
        if (response.destroyed) return;
      }
      const recommendations = await getRecommendations(question, answer, history);
      send('complete', { recommendations });
    } catch (error) {
      console.error('Gemini request failed:', error.message);
      if (!response.destroyed) send('error', { message: 'I could not finish that just now. Please try again in a moment.' });
    }
    response.end();
  });

  app.get('/api/health', (_request, response) => response.json({ ok: true }));

  app.use(express.static(path.join(appRoot, 'dist')));
  app.get('*path', (_request, response) => {
    response.sendFile(path.join(appRoot, 'dist', 'index.html'), error => {
      if (error && !response.headersSent) response.status(404).send('Build the application with npm run build first.');
    });
  });
  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3001;
  createApp().listen(port, () => console.log(`Google AI server listening on http://localhost:${port}`));
}