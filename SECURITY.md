# Security & Privacy Policy

## 🔒 Service Security

### How We Protect Your Data

1. **Server-Side API Key**: We use our own OpenAI API key to provide free AI features
2. **No User Keys Required**: You don't need to provide any API keys
3. **Rate Limiting**: Free tier has daily limits to prevent abuse
4. **Input Validation**: All inputs are validated and sanitized

### How the Service Works

```
Your Browser → Our Server → OpenAI API
     ↓              ↓           ↓
  [Your Text]   [Our Key]   [AI Response]
```

### Free Tier Limits

1. **Daily Limit**: 15 AI-generated slide sets per day per IP
2. **Rate Limiting**: 6 requests per minute to prevent abuse
3. **Input Size**: Maximum 8KB of text per request
4. **Model**: Uses gpt-4o-mini for cost efficiency

### What Happens When Limits Are Reached

- **Graceful Degradation**: Falls back to basic slide generation
- **Donation Prompt**: Shows support options to continue using AI features
- **No Data Loss**: Your content is preserved and still works

### Security Best Practices

1. **No Personal Data**: We don't collect or store personal information
2. **Input Validation**: All text inputs are validated and sanitized
3. **Rate Limiting**: Prevents abuse and ensures fair usage
4. **HTTPS Only**: All communications are encrypted

### What We Don't Do

- ❌ Store your personal data
- ❌ Require API keys from users
- ❌ Share your content with third parties
- ❌ Track your usage beyond rate limiting
- ❌ Access your personal information

### Open Source

This project is open source. You can:
- Review the code on GitHub
- Verify our security practices
- Run your own instance if preferred

## 🚨 If You Have Concerns

1. **Check Your OpenAI Usage**: Monitor your API usage dashboard
2. **Set Spending Limits**: Configure limits in your OpenAI account
3. **Use a Test Key**: Try with a limited test key first
4. **Contact Us**: Reach out if you have security questions

## 🔍 Technical Details

### Request Flow
```
1. User enters API key in browser
2. Key stored in React state (memory only)
3. On request, key sent in x-user-openai-key header
4. Server forwards request to OpenAI with user's key
5. Response returned to user
6. Key remains in memory, never persisted
```

### Server Implementation
- Express.js server acts as proxy
- CORS protection enabled
- Rate limiting implemented
- Input validation and sanitization
- Error handling without key exposure

---

**Last Updated**: $(date)
**Version**: 1.0.0
