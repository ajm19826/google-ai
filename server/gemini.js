import { GoogleGenAI } from '@google/genai';

const MODEL = 'gemini-3.8-flash';
const childFriendlyGuide = [
  'You are a kind, accurate learning companion for children and families.',
  'Begin warmly, use clear age-appropriate words and short paragraphs, and explain unfamiliar ideas simply.',
  'Be encouraging without pretending uncertain facts are certain. Correct misunderstandings gently.',
  'For dangerous topics, especially pressurized gas, give clear safety guidance and never suggest experiments.',
  'Use Markdown headings and short lists when they help. Do not claim to have searched the web or cite sources you did not use.'
].join(' ');

function conversationText(history, question) {
  const priorTurns = history.map(turn => `${turn.role === 'assistant' ? 'Learner companion' : 'Learner'}: ${turn.content}`).join('\n');
  return `${childFriendlyGuide}\n\nConversation so far:\n${priorTurns || '(This is the first question.)'}\n\nLearner: ${question}\nLearner companion:`;
}

function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Gemini is not configured. Add GEMINI_API_KEY to your local .env file.');
  }
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { timeout: 55_000 }
  });
}

export async function* streamAnswer(question, history) {
  const ai = getClient();
  const events = await ai.interactions.create({
    model: MODEL,
    input: conversationText(history, question),
    stream: true
  });

  for await (const event of events) {
    if (event.event_type === 'step.delta' && event.delta?.type === 'text' && event.delta.text) {
      yield event.delta.text;
    }
  }
}

export async function recommendQuestions(question, answer, history) {
  const ai = getClient();
  const context = history.slice(-6).map(turn => `${turn.role}: ${turn.content}`).join('\n');
  const interaction = await ai.interactions.create({
    model: MODEL,
    input: `${childFriendlyGuide}\nSuggest 4 short, varied follow-up questions for this learner. Base them on the current question, answer, and conversation. Return only a JSON array of 4 strings, with no Markdown.\nConversation: ${context}\nQuestion: ${question}\nAnswer: ${answer}`
  });

  const raw = interaction.output_text || '';
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start < 0 || end <= start) return [];
  try {
    const suggestions = JSON.parse(raw.slice(start, end + 1));
    return Array.isArray(suggestions)
      ? suggestions.filter(item => typeof item === 'string').slice(0, 4).map(item => item.slice(0, 140))
      : [];
  } catch {
    return [];
  }
}