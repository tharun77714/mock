# 🔐 MockMate Security Setup Guide

## ⚠️ URGENT: API Key Rotation Required

Your `.env.local` file contains exposed credentials. **You must immediately rotate these keys**:

### 1. **MongoDB Connection String**
- **Current Status**: ⚠️ Exposed (contains username:password)
- **Action**: 
  - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
  - Delete the current database user
  - Create a new user with a strong password
  - Update `MONGODB_URI` in `.env.local`

### 2. **Google Gemini API Key**
- **Current Status**: ⚠️ Exposed
- **Action**:
  - Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
  - Regenerate or delete the exposed key
  - Create a new key
  - Update `GOOGLE_GENERATIVE_AI_API_KEY` in `.env.local`

### 3. **Google OAuth Client Secret**
- **Current Status**: ⚠️ Exposed
- **Action**:
  - Go to [Google Cloud Console](https://console.cloud.google.com/)
  - Navigate to APIs & Services → Credentials
  - Delete the exposed OAuth credential
  - Create a new OAuth 2.0 Client ID
  - Update `GOOGLE_CLIENT_SECRET` in `.env.local`

### 4. **GitHub Alert Review**
- Check your GitHub Security Alerts for any detected credentials
- Review the specific files/commits mentioned in the alert
- Confirm all keys have been rotated

---

## ✅ Environment Variables Best Practices

### Frontend (.env.local in `/web`)

**NEVER expose these in frontend code:**
- ❌ `GOOGLE_CLIENT_SECRET`
- ❌ `SUPABASE_SERVICE_ROLE_KEY`
- ❌ `MONGODB_URI` (if contains auth)
- ❌ `OPENAI_API_KEY`
- ❌ `GROQ_API_KEY` (server-side only)

**Safe to expose (NEXT_PUBLIC_ prefix only):**
- ✅ `NEXT_PUBLIC_SUPABASE_URL` - Public Supabase URL
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Limited-permission key
- ✅ `NEXT_PUBLIC_VAPI_WEB_TOKEN` - Vapi client token
- ✅ `NEXT_PUBLIC_VAPI_WORKFLOW_ID` - Workflow ID
- ✅ `NEXT_PUBLIC_GOOGLE_CLIENT_ID` - OAuth client ID (not secret)

### Backend (`.env` in `/api`)

**Keep these completely secret:**
- 🔒 `MONGODB_URI`
- 🔒 `GROQ_API_KEY`
- 🔒 `GOOGLE_GENERATIVE_AI_API_KEY`
- 🔒 `OPENAI_API_KEY`
- 🔒 `SUPABASE_SERVICE_ROLE_KEY`

---

## 📋 Setup Checklist

- [ ] Rotate all exposed credentials (see above)
- [ ] Verify `.env.local` NOT in git history: `git log --all -- web/.env.local`
- [ ] Verify `.env` NOT in git history: `git log --all -- api/.env`
- [ ] Check `.gitignore` includes `.env*` and `.env.local`
- [ ] Create `.env.local` from `.env.example` template
- [ ] Run `git add` and commit the `.env.example` files
- [ ] Verify API keys work locally before deploying
- [ ] Use different keys for dev/staging/production

---

## 🔍 How to Find Exposed Credentials

### Check Git History
```bash
# Find all env files ever committed
git log --all --full-history --source -- "*.env*"

# Search for specific patterns
git log -S "MONGODB_URI" --all --oneline
git log -S "sk_test_" --all --oneline
git log -S "AIza" --all --oneline
```

### Search Codebase
```bash
# Look for hardcoded API keys
grep -r "sk_test_" .
grep -r "pk_test_" .
grep -r "AIza" .
grep -r "GOCSPX" .
```

### GitHub Security Alerts
- Check Repository Settings → Security & Analysis → Secret Scanning
- Review all detected secrets
- Confirm they've been rotated

---

## 🛡️ Production Deployment

### Environment Variable Management

**DO NOT use .env files in production!**

Use your platform's secrets management:

#### Vercel (Next.js)
1. Go to Project Settings → Environment Variables
2. Add each secret individually
3. Select appropriate environments (Development, Preview, Production)
4. Never paste entire .env files

#### Docker/Kubernetes
```bash
# Use docker secrets or environment variables
docker run \
  -e MONGODB_URI="$MONGODB_URI" \
  -e GROQ_API_KEY="$GROQ_API_KEY" \
  ...
```

#### AWS/Azure/GCP
- Use Parameter Store / Secrets Manager
- Create service accounts with minimal permissions
- Rotate keys regularly

---

## 📝 Required Environment Variables Summary

### Web Frontend (`/web/.env.local`)
```
MONGODB_URI
JWT_SECRET
NEXTAUTH_SECRET
NEXTAUTH_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_GENERATIVE_AI_API_KEY
GROQ_API_KEY
NEXT_PUBLIC_VAPI_WEB_TOKEN
NEXT_PUBLIC_VAPI_WORKFLOW_ID
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY (✅ safe in this context as it's server-side)
PYTHON_API_URL
```

### FastAPI Backend (`/api/.env`)
```
MONGODB_URI
GROQ_API_KEY
GROQ_MODEL (optional)
GOOGLE_GENERATIVE_AI_API_KEY
OPENAI_API_KEY (optional)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
PYTHON_API_URL (for local testing)
DEBUG (optional)
```

---

## 🚨 If Keys Were Compromised

1. **Immediately rotate** all exposed keys (see steps above)
2. **Check logs** for suspicious API usage
3. **Enable audit logging** on all platforms
4. **Set up alerts** for unusual API activity
5. **Review git history** to see what was exposed and when
6. **Add to `.gitignore`** and commit a "Remove sensitive data" commit

---

## ✨ Prevention Going Forward

1. **Use `.env.example`** - Commit empty templates, never real credentials
2. **Pre-commit hooks** - Install git hooks to prevent accidental commits
3. **CI/CD Secrets** - Use platform-specific secrets management
4. **Code review** - Always review PRs for hardcoded credentials
5. **Secret scanning** - Enable GitHub's secret scanning feature
6. **Regular audits** - Periodically review exposed credentials

