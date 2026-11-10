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

## Production and GitHub Pages

GitHub Pages hosts static files only. It cannot run the Gemini API server, so deploy the Node backend to a server host separately and keep `GEMINI_API_KEY` in that host's environment settings. The Pages frontend sends requests to that backend; the key never enters the browser build.

For the backend host, set:

```text
GEMINI_API_KEY=your_private_key
CORS_ORIGIN=https://YOUR-USERNAME.github.io
```

Use the exact origin of your Pages site (no path or trailing slash). For a custom domain, set CORS to that exact origin and change the Vite base path to `/`. Configure the GitHub repository variable `VITE_API_BASE_URL` as the backend's public HTTPS origin, for example `https://your-api.example.com`.

Then in the GitHub repository, open **Settings → Pages**, choose **GitHub Actions** as the build and deployment source, and push to `main`. The included workflow builds the app for the `/google-ai/` repository path and deploys `dist/`. It fails with a clear message if `VITE_API_BASE_URL` is missing, rather than publishing a non-working AI interface.

To run the built client and API together on a Node host instead of Pages:

```bash
npm run build
npm start
```

Set `GEMINI_API_KEY` and optionally `PORT` in the deployment platform's secret/environment settings. Add the new `google-ai` directory as its own Git repository and publish it as `google-ai` on GitHub:

```bash
git init -b main
git add .
git commit -m "Build Google AI learning app"
git remote add origin https://github.com/YOUR-USERNAME/google-ai.git
git push -u origin main
```

Conversation history and theme preferences are stored in the browser's local storage. Do not use shared/public devices for sensitive questions.