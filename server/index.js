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
const limiter = rateLimit({ windowMs: 60 * 1000, max: Number(process.env.RATE_LIMIT_RPM || 2), standardHeaders: true, legacyHeaders: false });
app.use('/api/', limiter);

// Helper to create client with provided key (BYOK) or server key
function createClient(key){ return new OpenAI({ apiKey: key }); }
const serverKey = process.env.OPENAI_API_KEY;
if (!serverKey) console.warn('[server] OPENAI_API_KEY is not set');

// Simple per-IP daily counter (memory). Replace with Redis for multi-instance.
const FREE_TIER_DAILY = Number(process.env.FREE_TIER_DAILY || 5);
const GLOBAL_DAILY_LIMIT = Number(process.env.GLOBAL_DAILY_LIMIT || 100);
const dailyCounters = new Map();
let globalDailyCount = 0;
let globalDailyDate = new Date().toISOString().slice(0,10);

function checkAndIncrementDaily(ip){
  const today = new Date().toISOString().slice(0,10);
  
  // Reset global counter if new day
  if (globalDailyDate !== today) {
    globalDailyCount = 0;
    globalDailyDate = today;
  }
  
  // Check global daily limit first
  if (globalDailyCount >= GLOBAL_DAILY_LIMIT) {
    console.log(`[server] Global daily limit reached: ${globalDailyCount}/${GLOBAL_DAILY_LIMIT}`);
    return { allowed: false, reason: 'global' };
  }
  
  // Check per-IP limit
  const cur = dailyCounters.get(ip);
  if (!cur || cur.day !== today){ 
    dailyCounters.set(ip, { day: today, count: 1 }); 
    globalDailyCount += 1;
    return { allowed: true, reason: 'ip', count: 1, globalCount: globalDailyCount };
  }
  if (cur.count >= FREE_TIER_DAILY) {
    return { allowed: false, reason: 'ip', count: cur.count, globalCount: globalDailyCount };
  }
  
  cur.count += 1;
  globalDailyCount += 1;
  return { allowed: true, reason: 'ip', count: cur.count, globalCount: globalDailyCount };
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
    const quotaResult = checkAndIncrementDaily(req.ip || req.headers['x-forwarded-for'] || 'anon');
    if (!quotaResult.allowed) {
      if (quotaResult.reason === 'global') {
        return res.status(429).json({ error: 'Service temporarily unavailable. Daily global limit reached. Please try again tomorrow.' });
      } else {
        return res.status(429).json({ error: 'Daily free tier limit reached. Support the project to continue!' });
      }
    }
    const userText = raw.trim();
    const isShort = userText.split(/\s+/).length < 12;
    const guidance = `You are a master slide & demo maker.

GOAL
Rewrite the USER's content into a compelling, original slide deck that feels crafted (not "internet-generic"). Preserve the user's meaning and intent; enrich only where needed for clarity and flow.

INPUTS
- USER_TEXT: ${userText}
- Optional: AUDIENCE (e.g., execs, engineers, students)
- Optional: PURPOSE (e.g., teach, persuade, propose, report)
- Optional: TONE (${tone} | educational | persuasive | executive)

RULES (must-follow)
1) Produce 6–10 slides total.
2) Each slide has:
   - First line = concise Title (3–6 words, no numbering).
   - Following lines = Body block (bullets preferred using "-" only).
3) Stay faithful to USER_TEXT. Do not add external facts, names, stats, or links. If the text is short or ambiguous, expand with neutral, illustrative examples and definitions—clearly generic, not factual claims.
4) Absolutely no empty bodies. No placeholders (no "TBD", "[image]", "Lorem ipsum").
5) Style: short sentences, concrete specifics, strong verbs, no fluff.
6) Output FORMAT is plain text: slides separated by ONE blank line; no numbering; no extra commentary or headers; no markdown.

CONTENT STRATEGY
- First slide = Hook: core idea + why it matters to the audience.
- Include: Context or background; Problem/Opportunity; Framework or Approach; Example/Scenario (generic, clearly illustrative); Criteria or Metrics; Risks & Mitigations; Action Plan / Next Steps; Close with 1–2 crisp takeaways.
- Define any essential terms in-line (one short bullet each).
- Prefer parallel structure across bullets; keep 3–6 bullets per slide; max ~10 words per bullet when possible.

ORIGINALITY & CLARITY FILTER
- Avoid cliché/buzzwords and filler. Especially avoid: "cutting-edge, leverage, synergy, next-gen, innovative solution, unlock, paradigm shift, game-changer."
- Use precise nouns and verbs. Replace abstractions with concrete phrasing drawn from USER_TEXT.
- Do not copy USER_TEXT verbatim—paraphrase for clarity and flow.

QUALITY CHECK BEFORE OUTPUT
- All slides have both Title and Body.
- Bullets use "-" only; no numbered lists.
- No hallucinated facts; examples read as illustrative, not factual claims.
- Single blank line between slides; nothing before the first slide or after the last.

NOW WRITE THE SLIDES
Use the selected TONE if provided; otherwise default to professional & concise. Deliver only the slides in the required plain-text format.`;

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
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit-Minute', Number(process.env.RATE_LIMIT_RPM || 2));
    res.setHeader('X-RateLimit-Remaining-Minute', Math.max(0, Number(process.env.RATE_LIMIT_RPM || 2) - 1)); // Approximate
    res.setHeader('X-RateLimit-Limit-Daily', FREE_TIER_DAILY);
    res.setHeader('X-RateLimit-Remaining-Daily', Math.max(0, FREE_TIER_DAILY - quotaResult.count));
    res.setHeader('X-RateLimit-Limit-Global', GLOBAL_DAILY_LIMIT);
    res.setHeader('X-RateLimit-Remaining-Global', Math.max(0, GLOBAL_DAILY_LIMIT - globalDailyCount));
    
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


