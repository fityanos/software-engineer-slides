import OpenAI from 'openai';

// Simple in-memory rate limiting (resets on serverless function restart)
// In production, you'd want to use Redis or a database for persistence
const rateLimitStore = new Map();
const dailyLimitStore = new Map();

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
  
  // Per-minute rate limiting
  const minuteKey = `${ip}:${minute}`;
  const minuteCount = rateLimitStore.get(minuteKey) || 0;
  const RATE_LIMIT_RPM = parseInt(process.env.RATE_LIMIT_RPM || '6', 10);
  
  if (minuteCount >= RATE_LIMIT_RPM) {
    return { allowed: false, reason: 'minute' };
  }
  
  // Daily quota limiting
  const dayKey = `${ip}:${day}`;
  const dayCount = dailyLimitStore.get(dayKey) || 0;
  const FREE_TIER_DAILY = parseInt(process.env.FREE_TIER_DAILY || '15', 10);
  
  if (dayCount >= FREE_TIER_DAILY) {
    return { allowed: false, reason: 'daily' };
  }
  
  // Increment counters
  rateLimitStore.set(minuteKey, minuteCount + 1);
  dailyLimitStore.set(dayKey, dayCount + 1);
  
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
  
  return { allowed: true, minuteCount: minuteCount + 1, dayCount: dayCount + 1 };
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
      return res.status(429).json({ 
        error: rateLimitResult.reason === 'daily' 
          ? 'Daily limit reached. Please try again tomorrow or consider supporting the project.' 
          : 'Rate limit exceeded. Please try again later.' 
      });
    }

    // Use server's API key only
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Server not configured: missing OPENAI_API_KEY' });
    }
    
    const openaiInstance = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
    const RATE_LIMIT_RPM = parseInt(process.env.RATE_LIMIT_RPM || '6', 10);
    const FREE_TIER_DAILY = parseInt(process.env.FREE_TIER_DAILY || '15', 10);
    
    res.setHeader('X-RateLimit-Limit-Minute', RATE_LIMIT_RPM);
    res.setHeader('X-RateLimit-Remaining-Minute', Math.max(0, RATE_LIMIT_RPM - rateLimitResult.minuteCount));
    res.setHeader('X-RateLimit-Limit-Daily', FREE_TIER_DAILY);
    res.setHeader('X-RateLimit-Remaining-Daily', Math.max(0, FREE_TIER_DAILY - rateLimitResult.dayCount));
    
    res.json({ content: out || '' });
  } catch (err) {
    console.error('API Error:', err);
    
    if (err.response && err.response.status === 429 && err.response.data?.error?.code === 'insufficient_quota') {
      return res.status(429).json({ error: 'OpenAI quota exceeded. Please try again later.' });
    }
    
    res.status(500).json({ error: 'Failed to generate story' });
  }
}
