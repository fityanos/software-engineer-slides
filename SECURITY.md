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

1. **Check Usage**: Monitor your daily usage (15 requests per day)
2. **Support the Project**: Consider donating to help maintain the service
3. **Contact Us**: Reach out if you have security questions
4. **Self-Host**: Run your own instance using the open source code

## 🔍 Technical Details

### Server Implementation
- Express.js server with OpenAI integration
- CORS protection enabled
- Rate limiting implemented (6 requests/minute, 15/day)
- Input validation and sanitization
- Graceful error handling

---

**Last Updated**: December 2024
**Version**: 2.0.0
