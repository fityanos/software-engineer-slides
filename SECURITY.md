# Security & Privacy Policy

## 🔒 API Key Safety

### How We Protect Your API Key

1. **No Storage**: Your API key is never stored on our servers or in your browser
2. **Direct Proxy**: Your key is sent directly to OpenAI through our secure server
3. **No Logging**: We mask API keys in all logs (shows as `sk-***1234`)
4. **Memory Only**: Keys exist only in your browser's memory during the session

### What Happens When You Use Your API Key

```
Your Browser → Our Server → OpenAI API
     ↓              ↓           ↓
  [Your Key]   [Proxy Only]  [Your Key]
```

### Verification Steps

1. **Check Network Tab**: 
   - Open browser DevTools (F12)
   - Go to Network tab
   - Make a request with your API key
   - Verify the key is sent to `/api/story` endpoint only

2. **Check Source Code**:
   - View page source (Ctrl+U)
   - Search for your API key - it should NOT appear anywhere
   - The key only exists in the request headers

3. **Check Server Logs**:
   - Our server logs show masked keys: `sk-***1234`
   - Your full key is never logged

### Security Best Practices

1. **Use a Dedicated Key**: Create a separate OpenAI API key for this service
2. **Set Usage Limits**: Configure spending limits in your OpenAI account
3. **Monitor Usage**: Check your OpenAI dashboard regularly
4. **Revoke if Needed**: You can revoke the key anytime from OpenAI

### What We Don't Do

- ❌ Store your API key
- ❌ Log your full API key
- ❌ Share your key with third parties
- ❌ Use your key for other purposes
- ❌ Access your OpenAI account

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
