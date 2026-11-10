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

Open the Vite URL printed in the terminal (usually `http://localhost:5173`). With `GEMINI_API_KEY`, requests use the local Node backend and the key stays private. For direct browser access, set `VITE_GEMINI_API_KEY` instead; this key is visible to anyone using the app.

## Verify

```bash
npm test
npm run check
npm run build
```

The tests cover request validation, streaming, conversation context, and friendly provider-error handling. A live Gemini request additionally requires a valid API key and network access.

## GitHub Pages

Pages is static hosting, so the easiest setup is direct browser access to Gemini. **A `VITE_GEMINI_API_KEY` is public:** it is embedded in the built JavaScript and can be copied by every visitor. Use a dedicated key, restrict it to your Pages website and the Gemini API in Google AI Studio/Google Cloud, and set conservative quotas. A server-side key is safer for a public production app.

Create `.env` from `.env.example`, set `VITE_GEMINI_API_KEY`, then deploy from the terminal:

```bash
npm run deploy:pages
```

This builds the site for `/google-ai/` and publishes `dist/` to the `gh-pages` branch. In GitHub, open **Settings → Pages**, select **Deploy from a branch**, choose `gh-pages` and `/(root)`, and save. No GitHub Actions workflow is used. The repository needs an `origin` remote and your local Git credentials must be able to push to it.

To keep the key private instead, deploy the Node backend to a server host and set `GEMINI_API_KEY` there. Set `VITE_API_BASE_URL` to that server's HTTPS origin in the frontend build, and set `CORS_ORIGIN` on the server to the exact Pages origin. The local Vite proxy supports this private-backend mode during development.

To run the built client and private API together on a Node host:

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