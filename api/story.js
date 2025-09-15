import OpenAI from 'openai';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-user-openai-key, Authorization');

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

    // Determine which API key to use
    let openaiInstance;
    let isBYOK = false;
    const userApiKey = req.headers['x-user-openai-key'] || 
      (req.headers['authorization'] && req.headers['authorization'].startsWith('Bearer ') ? 
        req.headers['authorization'].slice(7) : null);

    if (userApiKey && userApiKey.startsWith('sk-')) {
      openaiInstance = new OpenAI({ apiKey: userApiKey });
      isBYOK = true;
    } else {
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ error: 'Server not configured: missing OPENAI_API_KEY' });
      }
      openaiInstance = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }

    // For Vercel, we'll implement a simple rate limiting using headers
    // In production, you might want to use a more sophisticated solution
    const rateLimitKey = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const rateLimitCount = parseInt(req.headers['x-rate-limit-count'] || '0', 10);
    const RATE_LIMIT_RPM = parseInt(process.env.RATE_LIMIT_RPM || '6', 10);
    
    if (!isBYOK && rateLimitCount >= RATE_LIMIT_RPM) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }

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
    res.setHeader('X-RateLimit-Limit', RATE_LIMIT_RPM);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT_RPM - rateLimitCount - 1));
    
    res.json({ content: out || '' });
  } catch (err) {
    console.error('API Error:', err);
    
    if (err.response && err.response.status === 429 && err.response.data?.error?.code === 'insufficient_quota') {
      return res.status(429).json({ error: 'OpenAI quota exceeded. Please try again later or use your own API key.' });
    }
    
    res.status(500).json({ error: 'Failed to generate story' });
  }
}
