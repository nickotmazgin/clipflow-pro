# Free AI APIs Setup Guide for Aider

## 🥇 **ANTHROPIC CLAUDE (RECOMMENDED)**

### Sign Up:
1. Go to: https://console.anthropic.com/
2. Create account with email
3. Verify email
4. Get API key from dashboard

### Usage:
```bash
export ANTHROPIC_API_KEY="your_key_here"
aider --haiku
```

### Benefits:
- ✅ 5 free requests/day
- ✅ $5 credit monthly (renews)
- ✅ Excellent coding quality
- ✅ Very smart reasoning

---

## 🥈 **OPENAI (VERY GOOD)**

### Sign Up:
1. Go to: https://platform.openai.com/
2. Create account
3. Add payment method (for verification)
4. Get $5 free credit monthly

### Usage:
```bash
export OPENAI_API_KEY="your_key_here"
aider --mini
```

### Benefits:
- ✅ $5 credit monthly (renews)
- ✅ Great for coding
- ✅ Widely supported

---

## 🥉 **GOOGLE GEMINI (GENEROUS)**

### Sign Up:
1. Go to: https://aistudio.google.com/
2. Sign in with Google account
3. Get API key from "Get API key"

### Usage:
```bash
export GOOGLE_API_KEY="your_key_here"
aider --model google/gemini-pro
```

### Benefits:
- ✅ 15 requests/minute
- ✅ 1M tokens/day
- ✅ Very generous limits
- ✅ Good coding quality

---

## 🆓 **GROQ (FAST & FREE)**

### Sign Up:
1. Go to: https://console.groq.com/
2. Create account
3. Get API key

### Usage:
```bash
export GROQ_API_KEY="your_key_here"
aider --model groq/llama-3.1-70b-versatile
```

### Benefits:
- ✅ 14,400 requests/day
- ✅ Very fast responses
- ✅ Good for coding
- ✅ No credit card required

---

## 🆓 **TOGETHER AI (GOOD)**

### Sign Up:
1. Go to: https://api.together.xyz/
2. Create account
3. Get API key

### Usage:
```bash
export TOGETHER_API_KEY="your_key_here"
aider --model together/llama-2-70b-chat
```

### Benefits:
- ✅ $25 credit monthly
- ✅ Good coding quality
- ✅ Multiple models available

---

## 🚀 **QUICK START (RECOMMENDED ORDER):**

1. **Start with Groq** (no credit card, very generous)
2. **Add Anthropic** (best quality, small free tier)
3. **Add Google Gemini** (most generous limits)
4. **Add OpenAI** (if you want the best overall)

## 🔧 **SETUP SCRIPT:**

```bash
# Add to your ~/.bashrc or ~/.zshrc
export ANTHROPIC_API_KEY="your_anthropic_key"
export OPENAI_API_KEY="your_openai_key"
export GOOGLE_API_KEY="your_google_key"
export GROQ_API_KEY="your_groq_key"
export TOGETHER_API_KEY="your_together_key"

# Then restart terminal or run:
source ~/.bashrc
```

## 💡 **PRO TIPS:**

1. **Use multiple APIs** - Aider will automatically try different ones
2. **Start with Groq** - most generous free tier
3. **Keep Anthropic** - best quality for complex tasks
4. **Monitor usage** - check API dashboards regularly
5. **Use local models** - for unlimited free usage (slower but free)

## 🎯 **FOR CLIPFLOW PRO:**

Once you have API keys, you can use Aider to:
- Add keyboard shortcuts
- Improve search functionality
- Add pinning features
- Add export/import
- Optimize performance
- Add visual indicators

Just run: `aider` and start asking for improvements!
