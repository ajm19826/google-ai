import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import './style.css';

const STORAGE_KEY = 'google-ai-conversations-v1';
const THEME_KEY = 'google-ai-theme';
const starterQuestions = [
  ['Science', 'Why is the sky blue?'],
  ['Everyday science', 'Why do helium balloons float?'],
  ['Curiosity', 'Can a balloon reach the moon?'],
  ['How things work', 'How does an air compressor work?']
];

let sessions = loadSessions();
let activeSessionId = null;
let pending = false;
let collapsed = false;

document.querySelector('#app').innerHTML = `
  <div class="app-shell">
    <aside class="sidebar" id="sidebar" aria-label="Conversation history">
      <div class="rail-top">
        <button class="icon-button menu-button" id="menu-toggle" aria-label="Toggle sidebar" title="Toggle sidebar"><span class="menu-glyph">☰</span></button>
        <a class="brand-mark" href="#" aria-label="Google AI home"><span>G</span></a>
      </div>
      <button class="new-chat" id="new-chat"><span class="new-chat-icon">＋</span><span class="sidebar-label">New conversation</span></button>
      <div class="history-heading sidebar-label">Recent</div>
      <nav class="history-list" id="history-list" aria-label="Recent conversations"></nav>
      <div class="sidebar-bottom"><span class="status-dot"></span><span class="sidebar-label">Independent learning companion</span></div>
    </aside>
    <div class="main-column">
      <header class="topbar">
        <div class="top-nav" aria-label="Search mode">
          <span class="active-tab">AI Mode</span><span>All</span><span>Images</span><span>Videos</span><span>News</span><span class="more-tab">More ⌄</span>
        </div>
        <div class="top-actions">
          <span class="model-badge"><span class="sparkle">✦</span> Gemini</span>
          <button class="icon-button theme-toggle" id="theme-toggle" aria-label="Switch to light theme" title="Switch theme"><span aria-hidden="true">☼</span></button>
          <button class="apps-button" aria-label="About this app" title="About this independent app">⋮</button>
          <button class="profile-button" aria-label="Local profile">A</button>
        </div>
      </header>
      <main class="page-content">
        <section class="welcome" id="welcome">
          <div class="welcome-mark"><span class="brand-mark large"><span>G</span></span><span class="welcome-sparkle">✦</span></div>
          <h1>Hi there, what's on your mind?</h1>
          <p>Ask anything. Let’s figure it out together.</p>
        </section>
        <section class="results" id="results" aria-live="polite" aria-label="Conversation"></section>
        <form class="composer" id="question-form">
          <label class="visually-hidden" for="question-input">Ask a question</label>
          <textarea id="question-input" rows="1" placeholder="Ask anything" maxlength="1000" required></textarea>
          <div class="composer-footer">
            <span class="composer-hint" id="composer-hint">Curiosity starts here</span>
            <button class="send-button" id="send-button" type="submit" aria-label="Send question" title="Send question"><span aria-hidden="true">↑</span></button>
          </div>
        </form>
        <section class="starters" id="starters" aria-label="Try asking">
          <div class="starters-heading">A few places to start</div>
          <div class="starter-grid">${starterQuestions.map(([category, question]) => `
            <button class="starter-card" type="button" data-question="${question}">
              <span class="starter-category">${category}</span><span>${question}</span><span class="starter-arrow" aria-hidden="true">↗</span>
            </button>`).join('')}
          </div>
        </section>
      </main>
      <footer class="page-footer">AI can make mistakes. Check important information with a trusted adult. <span>Independent project, not affiliated with Google.</span></footer>
    </div>
  </div>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
`;

const form = document.querySelector('#question-form');
const input = document.querySelector('#question-input');
const results = document.querySelector('#results');
const welcome = document.querySelector('#welcome');
const starters = document.querySelector('#starters');
const sendButton = document.querySelector('#send-button');
const historyList = document.querySelector('#history-list');
const sidebar = document.querySelector('#sidebar');
const toast = document.querySelector('#toast');
let toastTimer;

marked.setOptions({ breaks: true, gfm: true });
document.documentElement.dataset.theme = localStorage.getItem(THEME_KEY) || 'dark';
updateThemeButton();
renderHistory();
renderActiveSession();

form.addEventListener('submit', event => {
  event.preventDefault();
  submitQuestion(input.value);
});

input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
});

input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

document.querySelector('#new-chat').addEventListener('click', startNewConversation);
document.querySelector('#menu-toggle').addEventListener('click', () => {
  collapsed = !collapsed;
  sidebar.classList.toggle('collapsed', collapsed);
  sidebar.classList.toggle('mobile-open', !collapsed && window.matchMedia('(max-width: 720px)').matches);
});

document.querySelector('#theme-toggle').addEventListener('click', () => {
  const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem(THEME_KEY, nextTheme);
  updateThemeButton();
});

document.querySelectorAll('.starter-card').forEach(button => {
  button.addEventListener('click', () => submitQuestion(button.dataset.question));
});

historyList.addEventListener('click', event => {
  const button = event.target.closest('[data-session-id]');
  if (!button) return;
  activeSessionId = button.dataset.sessionId;
  sidebar.classList.remove('mobile-open');
  renderHistory();
  renderActiveSession();
});

results.addEventListener('click', event => {
  const recommendation = event.target.closest('[data-recommendation]');
  if (recommendation) {
    submitQuestion(recommendation.dataset.recommendation);
    return;
  }
  const action = event.target.closest('[data-action]');
  if (!action || pending) return;
  const turnIndex = Number(action.dataset.index);
  const turn = getActiveSession()?.turns[turnIndex];
  if (!turn) return;
  if (action.dataset.action === 'copy') {
    navigator.clipboard?.writeText(turn.answer).then(() => showToast('Answer copied')).catch(() => showToast('Could not copy this answer'));
  } else if (action.dataset.action === 'regenerate') {
    generateAnswer(turnIndex, true);
  } else if (action.dataset.action === 'feedback') {
    turn.feedback = turn.feedback === action.dataset.value ? '' : action.dataset.value;
    saveSessions();
    renderActiveSession();
  } else if (action.dataset.action === 'retry') {
    generateAnswer(turnIndex, true);
  }
});

function loadSessions() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? saved.filter(session => session && Array.isArray(session.turns)) : [];
  } catch {
    return [];
  }
}

function saveSessions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, 30)));
}

function getActiveSession() {
  return sessions.find(session => session.id === activeSessionId);
}

function startNewConversation() {
  activeSessionId = null;
  sidebar.classList.remove('mobile-open');
  renderHistory();
  renderActiveSession();
  input.focus();
}

function renderHistory() {
  historyList.innerHTML = sessions.slice(0, 12).map(session => `
    <button class="history-item ${session.id === activeSessionId ? 'selected' : ''}" type="button" data-session-id="${escapeHtml(session.id)}" title="${escapeHtml(session.title)}">
      <span class="history-icon" aria-hidden="true">◷</span><span class="sidebar-label">${escapeHtml(session.title)}</span>
    </button>`).join('');
}

function renderActiveSession() {
  const session = getActiveSession();
  const turns = session?.turns || [];
  welcome.hidden = turns.length > 0;
  starters.hidden = turns.length > 0;
  results.innerHTML = turns.map((turn, index) => turnMarkup(turn, index)).join('');
  results.classList.toggle('has-results', turns.length > 0);
  results.scrollTop = results.scrollHeight;
}

function turnMarkup(turn, index) {
  const answer = turn.answer
    ? DOMPurify.sanitize(marked.parse(turn.answer))
    : turn.error
      ? `<div class="answer-error">${escapeHtml(turn.error)} <button type="button" data-action="retry" data-index="${index}">Try again</button></div>`
      : '<div class="typing-indicator" aria-label="Generating an answer"><i></i><i></i><i></i></div>';
  const tools = turn.answer ? `
    <div class="answer-tools" aria-label="Answer actions">
      <button type="button" data-action="copy" data-index="${index}" title="Copy answer" aria-label="Copy answer">▢</button>
      <button type="button" data-action="regenerate" data-index="${index}" title="Regenerate answer" aria-label="Regenerate answer">↻</button>
      <button type="button" data-action="feedback" data-value="up" data-index="${index}" title="Helpful" aria-label="Helpful" aria-pressed="${turn.feedback === 'up'}">＋</button>
      <button type="button" data-action="feedback" data-value="down" data-index="${index}" title="Not helpful" aria-label="Not helpful" aria-pressed="${turn.feedback === 'down'}">−</button>
    </div>` : '';
  const questions = turn.recommendations?.length ? `
    <section class="recommendations" aria-labelledby="recommended-${index}">
      <h2 id="recommended-${index}">Recommended Questions</h2>
      <div class="recommendation-list">${turn.recommendations.map(question => `
        <button type="button" class="recommendation" data-recommendation="${escapeHtml(question)}">
          <span>${escapeHtml(question)}</span><span aria-hidden="true">↗</span>
        </button>`).join('')}
      </div>
    </section>` : '';
  return `<article class="turn">
    <div class="question-bubble">${escapeHtml(turn.question)}</div>
    <div class="answer-wrap"><div class="answer-markdown">${answer}</div>${tools}</div>${questions}
  </article>`;
}

async function submitQuestion(rawQuestion) {
  const question = rawQuestion.trim();
  if (pending || !question || question.length > 1000) return;
  if (!getActiveSession()) {
    const session = { id: crypto.randomUUID(), title: question.slice(0, 48), turns: [], updatedAt: Date.now() };
    sessions.unshift(session);
    activeSessionId = session.id;
  }
  const session = getActiveSession();
  session.turns.push({ question, answer: '', recommendations: [] });
  session.updatedAt = Date.now();
  saveSessions();
  renderHistory();
  renderActiveSession();
  welcome.hidden = true;
  starters.hidden = true;
  input.value = '';
  input.style.height = 'auto';
  await generateAnswer(session.turns.length - 1, false);
}

async function generateAnswer(turnIndex, regenerate) {
  if (pending) return;
  const session = getActiveSession();
  const turn = session?.turns[turnIndex];
  if (!turn) return;
  pending = true;
  sendButton.disabled = true;
  input.disabled = true;
  document.querySelector('#composer-hint').textContent = 'Thinking it through…';
  turn.error = '';
  turn.recommendations = [];
  if (regenerate) turn.answer = '';
  renderActiveSession();
  const answerNode = results.querySelectorAll('.answer-markdown')[turnIndex];
  const priorTurns = session.turns.slice(0, turnIndex).flatMap(item => [
    { role: 'user', content: item.question },
    { role: 'assistant', content: item.answer }
  ]);
  let streamedText = '';

  try {
    const response = await fetch('/api/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: turn.question, history: priorTurns }),
      signal: AbortSignal.timeout(70_000)
    });
    if (!response.ok) {
      const problem = await response.json().catch(() => ({}));
      throw new Error(problem.error || 'I could not start that request. Please try again.');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let recommendations = [];
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || '';
      for (const rawEvent of events) {
        const eventName = rawEvent.match(/^event: (.+)$/m)?.[1];
        const data = rawEvent.match(/^data: (.+)$/m)?.[1];
        if (!eventName || !data) continue;
        const payload = JSON.parse(data);
        if (eventName === 'token') {
          streamedText += payload.text;
          answerNode.textContent = streamedText;
        } else if (eventName === 'complete') {
          recommendations = payload.recommendations || [];
        } else if (eventName === 'error') {
          throw new Error(payload.message);
        }
      }
      if (done) break;
    }
    if (!streamedText.trim()) throw new Error('I did not get an answer that time. Please try again.');
    turn.answer = streamedText;
    turn.recommendations = recommendations;
    turn.error = '';
  } catch (error) {
    turn.answer = streamedText;
    turn.error = error.name === 'TimeoutError'
      ? 'That took longer than expected.'
      : (error.message || 'Something went wrong.');
  } finally {
    pending = false;
    sendButton.disabled = false;
    input.disabled = false;
    document.querySelector('#composer-hint').textContent = 'Curiosity starts here';
    session.updatedAt = Date.now();
    saveSessions();
    renderHistory();
    renderActiveSession();
    input.focus();
  }
}

function updateThemeButton() {
  const dark = document.documentElement.dataset.theme === 'dark';
  const button = document.querySelector('#theme-toggle');
  button.innerHTML = `<span aria-hidden="true">${dark ? '☼' : '☾'}</span>`;
  button.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`);
  button.title = `Switch to ${dark ? 'light' : 'dark'} theme`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2200);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}