# Google AI

An independent, Gemini-powered question and learning app with a familiar search layout. This is an original project and is not affiliated with, endorsed by, or an official product of Google.

## Features

- Streaming answers from Google's current Gemini API through the official `@google/genai` SDK.
- Context-aware, dynamically generated recommended questions.
- Child-friendly response guidance, with extra care around safety-sensitive topics.
- Local conversation history, copy/regenerate controls, answer feedback, and dark/light themes.
- A server-side API key, request limits, security headers, input validation, and friendly API errors.

## Requirements

- Node.js 20.19 or newer.
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).

## Run locally

```bash
npm install
cp .env.example .env
```

Add your key to `.env` as `GEMINI_API_KEY=...`, then start the app:

```bash
npm run dev
```

Open the Vite URL printed in the terminal (usually `http://localhost:5173`). The Vite development server forwards `/api` requests to the private Node server on port 3001. Never put the key in frontend code or commit `.env`.

## Verify

```bash
npm test
npm run check
npm run build
```

The tests cover request validation, streaming, conversation context, and friendly provider-error handling. A live Gemini request additionally requires a valid API key and network access.

## Production and GitHub

Build the static client and run the Node server, which serves both the built app and `/api`:

```bash
npm run build
npm start
```

Set `GEMINI_API_KEY` and optionally `PORT` in the deployment platform's secret/environment settings. Deploy the Node server as a single application; the key must remain server-side. Add the new `google-ai` directory as its own Git repository and publish it as `google-ai` on GitHub:

```bash
git init -b main
git add .
git commit -m "Build Google AI learning app"
git remote add origin https://github.com/YOUR-USERNAME/google-ai.git
git push -u origin main
```

Conversation history and theme preferences are stored in the browser's local storage. Do not use shared/public devices for sensitive questions.