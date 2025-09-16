import OpenAI from 'openai';

// Simple in-memory rate limiting (resets on serverless function restart)
// In production, you'd want to use Redis or a database for persistence
const rateLimitStore = new Map();
const dailyLimitStore = new Map();
let globalDailyCount = 0;
let globalDailyDate = new Date().toISOString().slice(0,10);

function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
         req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const minute = Math.floor(now / 60000); // Current minute
  const day = Math.floor(now / 86400000); // Current day
  const today = new Date().toISOString().slice(0,10);
  
  // Reset global counter if new day
  if (globalDailyDate !== today) {
    globalDailyCount = 0;
    globalDailyDate = today;
  }
  
  // Check global daily limit first
  const GLOBAL_DAILY_LIMIT = parseInt(process.env.GLOBAL_DAILY_LIMIT || '100', 10);
  if (globalDailyCount >= GLOBAL_DAILY_LIMIT) {
    console.log(`Global daily limit reached: ${globalDailyCount}/${GLOBAL_DAILY_LIMIT}`);
    return { allowed: false, reason: 'global' };
  }
  
  // Per-minute rate limiting
  const minuteKey = `${ip}:${minute}`;
  const minuteCount = rateLimitStore.get(minuteKey) || 0;
  const RATE_LIMIT_RPM = parseInt(process.env.RATE_LIMIT_RPM || '2', 10);
  
  if (minuteCount >= RATE_LIMIT_RPM) {
    return { allowed: false, reason: 'minute' };
  }
  
  // Daily quota limiting
  const dayKey = `${ip}:${day}`;
  const dayCount = dailyLimitStore.get(dayKey) || 0;
  const FREE_TIER_DAILY = parseInt(process.env.FREE_TIER_DAILY || '5', 10);
  
  if (dayCount >= FREE_TIER_DAILY) {
    return { allowed: false, reason: 'daily' };
  }
  
  // Increment counters
  rateLimitStore.set(minuteKey, minuteCount + 1);
  dailyLimitStore.set(dayKey, dayCount + 1);
  globalDailyCount += 1;
  
  // Clean up old entries (keep only last 2 minutes and 2 days)
  for (const [key] of rateLimitStore) {
    const [storedIP, storedMinute] = key.split(':');
    if (storedMinute < minute - 1) {
      rateLimitStore.delete(key);
    }
  }
  
  for (const [key] of dailyLimitStore) {
    const [storedIP, storedDay] = key.split(':');
    if (storedDay < day - 1) {
      dailyLimitStore.delete(key);
    }
  }
  
  return { allowed: true, minuteCount: minuteCount + 1, dayCount: dayCount + 1, globalCount: globalDailyCount };
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { raw, tone = 'inspiring', length = 'medium', model = 'gpt-4o-mini' } = req.body || {};

    // Input validation
    if (!raw || typeof raw !== 'string' || raw.trim().length === 0) {
      return res.status(400).json({ error: 'Missing raw content' });
    }

    const MAX_RAW_BYTES = parseInt(process.env.MAX_RAW_BYTES || '8192', 10);
    if (raw.length > MAX_RAW_BYTES) {
      return res.status(413).json({ error: `Input content too large. Max ${MAX_RAW_BYTES / 1024}KB.` });
    }

    const allowedModels = (process.env.ALLOWED_MODELS || 'gpt-4o-mini').split(',');
    if (!allowedModels.includes(model)) {
      return res.status(400).json({ error: `Model '${model}' is not allowed.` });
    }

    // Check rate limits
    const clientIP = getClientIP(req);
    const rateLimitResult = checkRateLimit(clientIP);
    
    if (!rateLimitResult.allowed) {
      console.log(`Rate limit exceeded for IP ${clientIP}: ${rateLimitResult.reason}`);
      let errorMessage = 'Rate limit exceeded. Please try again later.';
      
      if (rateLimitResult.reason === 'global') {
        errorMessage = 'Service temporarily unavailable. Daily global limit reached. Please try again tomorrow.';
      } else if (rateLimitResult.reason === 'daily') {
        errorMessage = 'Daily limit reached. Please try again tomorrow or consider supporting the project.';
      }
      
      return res.status(429).json({ error: errorMessage });
    }

    // Use server's API key only
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Server not configured: missing OPENAI_API_KEY' });
    }
    
    const openaiInstance = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

    const completion = await openaiInstance.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You create high-quality, concise slide decks. Output plain text only with titles and bodies per slide, separated by blank lines.' },
        { role: 'user', content: guidance },
      ],
      temperature: 0.85,
      max_completion_tokens: parseInt(process.env.MAX_COMPLETION_TOKENS || '600', 10),
    });

    const out = completion.choices?.[0]?.message?.content?.trim();
    
    // Set rate limit headers
    const RATE_LIMIT_RPM = parseInt(process.env.RATE_LIMIT_RPM || '2', 10);
    const FREE_TIER_DAILY = parseInt(process.env.FREE_TIER_DAILY || '5', 10);
    const GLOBAL_DAILY_LIMIT = parseInt(process.env.GLOBAL_DAILY_LIMIT || '100', 10);
    
    res.setHeader('X-RateLimit-Limit-Minute', RATE_LIMIT_RPM);
    res.setHeader('X-RateLimit-Remaining-Minute', Math.max(0, RATE_LIMIT_RPM - rateLimitResult.minuteCount));
    res.setHeader('X-RateLimit-Limit-Daily', FREE_TIER_DAILY);
    res.setHeader('X-RateLimit-Remaining-Daily', Math.max(0, FREE_TIER_DAILY - rateLimitResult.dayCount));
    res.setHeader('X-RateLimit-Limit-Global', GLOBAL_DAILY_LIMIT);
    res.setHeader('X-RateLimit-Remaining-Global', Math.max(0, GLOBAL_DAILY_LIMIT - rateLimitResult.globalCount));
    
    res.json({ content: out || '' });
  } catch (err) {
    console.error('API Error:', err);
    
    if (err.response && err.response.status === 429 && err.response.data?.error?.code === 'insufficient_quota') {
      return res.status(429).json({ error: 'OpenAI quota exceeded. Please try again later.' });
    }
    
    res.status(500).json({ error: 'Failed to generate story' });
  }
}
