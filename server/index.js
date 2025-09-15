import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const app = express();
// CORS: allow specific origins if provided via env
const corsOrigin = process.env.CORS_ORIGIN?.split(',').map(s=>s.trim()).filter(Boolean);
app.use(cors({ origin: corsOrigin && corsOrigin.length > 0 ? corsOrigin : true }));
// Body size limit
app.use(express.json({ limit: '1mb' }));

// Per-minute rate limit (tighten for free tier)
const limiter = rateLimit({ windowMs: 60 * 1000, max: Number(process.env.RATE_LIMIT_RPM || 6), standardHeaders: true, legacyHeaders: false });
app.use('/api/', limiter);

// Helper to create client with provided key (BYOK) or server key
function createClient(key){ return new OpenAI({ apiKey: key }); }
const serverKey = process.env.OPENAI_API_KEY;
if (!serverKey) console.warn('[server] OPENAI_API_KEY is not set');

// Simple per-IP daily counter (memory). Replace with Redis for multi-instance.
const FREE_TIER_DAILY = Number(process.env.FREE_TIER_DAILY || 15);
const dailyCounters = new Map();
function checkAndIncrementDaily(ip){
  const today = new Date().toISOString().slice(0,10);
  const cur = dailyCounters.get(ip);
  if (!cur || cur.day !== today){ dailyCounters.set(ip, { day: today, count: 1 }); return true; }
  if (cur.count >= FREE_TIER_DAILY) return false;
  cur.count += 1; return true;
}

const ALLOWED_MODELS = new Set((process.env.ALLOWED_MODELS || 'gpt-4o-mini').split(',').map(s=>s.trim()).filter(Boolean));
const MAX_RAW_BYTES = Number(process.env.MAX_RAW_BYTES || 8 * 1024);
const MAX_COMPLETION_TOKENS = Number(process.env.MAX_COMPLETION_TOKENS || 600);

app.post('/api/story', async (req, res) => {
  try {
    const { raw, tone = 'inspiring', length = 'medium', model = 'gpt-4o-mini' } = req.body || {};
    if (!raw || typeof raw !== 'string' || raw.trim().length === 0) {
      return res.status(400).json({ error: 'Missing raw content' });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Server not configured: missing OPENAI_API_KEY' });
    }
    // Input size cap
    const sizeBytes = Buffer.byteLength(raw, 'utf8');
    if (sizeBytes > MAX_RAW_BYTES) {
      return res.status(413).json({ error: `Input too large (>${MAX_RAW_BYTES} bytes)` });
    }
    // Model allowlist
    if (!ALLOWED_MODELS.has(model)) {
      return res.status(400).json({ error: 'Model not allowed' });
    }

    // Use server's API key only
    const openai = createClient(serverKey);

    // Daily quota for free tier
    const ok = checkAndIncrementDaily(req.ip || req.headers['x-forwarded-for'] || 'anon');
    if (!ok) return res.status(429).json({ error: 'Daily free tier limit reached. Support the project to continue!' });
    const userText = raw.trim();
    const isShort = userText.split(/\s+/).length < 12;
    const guidance = `
You will rewrite USER content into a compelling slide deck. If the USER text is short or ambiguous, expand it with relevant context and details. Use the provided content as the foundation and build upon it logically. Avoid empty sections and placeholders.

Requirements:
- Produce 6-10 slides based on the user's content.
- Each slide must have a concise Title on the first line and a Body block below.
- Prefer bullets with '-' for lists. Use short sentences and concrete, specific details.
- Stay true to the user's content and intent. Don't add unrelated information.
- Absolutely no empty bodies. No section titles without substance.
- Tone: ${tone}. Length: ${length}.
- Output FORMAT strictly as plain text: each slide separated by ONE blank line. Do not number slides. Do not add extra commentary.

USER CONTENT:
${userText}
`;

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You create high-quality, concise slide decks. Output plain text only with titles and bodies per slide, separated by blank lines.' },
        { role: 'user', content: guidance },
      ],
      temperature: 0.8,
      max_completion_tokens: MAX_COMPLETION_TOKENS,
    });
    const out = completion.choices?.[0]?.message?.content?.trim();
    res.json({ content: out || '' });
  } catch (err) {
    const msg = (err && err.message) || 'Failed to generate story';
    if (String(msg).toLowerCase().includes('insufficient_quota')) {
      return res.status(429).json({ error: 'Free tier exhausted. Try later or use your own API key.' });
    }
    console.error('[api/story] error:', msg);
    res.status(500).json({ error: 'Failed to generate story' });
  }
});

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});


