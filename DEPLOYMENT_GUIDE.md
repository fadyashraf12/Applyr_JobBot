# Deployment Guide for Applyr JobBot

Complete step-by-step guide to deploy Applyr to Vercel with all services configured.

## Prerequisites

- Node.js 18+ installed locally
- Firebase project created
- Google Cloud project with OAuth credentials
- Vercel account
- GitHub repository access

## Phase 1: Firebase Setup

### 1.1 Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Add Project**
3. Name it `applyr-production`
4. Enable Google Analytics (optional)
5. Click **Create Project**

### 1.2 Enable Authentication

1. Go to **Authentication** → **Sign-in method**
2. Enable **Google** provider
3. Add your Vercel domain to authorized domains:
   - `your-app.vercel.app`
   - `localhost:5173` (for local development)

### 1.3 Create Firestore Database

1. Go to **Firestore Database**
2. Click **Create Database**
3. Choose **Production mode**
4. Select region (e.g., `us-central1`)
5. Click **Create**

### 1.4 Deploy Firestore Rules

```bash
firebase login
firebase deploy --only firestore:rules
```

### 1.5 Create Service Account

1. Go to **Project Settings** → **Service Accounts**
2. Click **Generate New Private Key**
3. Save the JSON file securely
4. Note the following values:
   - `project_id`
   - `client_email`
   - `private_key`

## Phase 2: Google OAuth Setup

### 2.1 Create OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client ID**
5. Choose **Web application**
6. Add authorized redirect URIs:
   ```
   https://your-app.vercel.app/api/auth/google/callback
   http://localhost:5173/api/auth/google/callback
   ```
7. Click **Create**
8. Copy the **Client ID** and **Client Secret**

### 2.2 Enable Required APIs

Go to **APIs & Services** → **Library** and enable:

- Google Drive API
- Gmail API
- Google People API

## Phase 3: Vercel Deployment

### 3.1 Connect Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New** → **Project**
3. Select your GitHub repository
4. Click **Import**

### 3.2 Configure Environment Variables

In Vercel project settings, add these environment variables:

#### Firebase Configuration (Public)
```
VITE_FIREBASE_API_KEY=<from firebase-applet-config.json>
VITE_FIREBASE_AUTH_DOMAIN=<your-project>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<your-project-id>
VITE_FIREBASE_STORAGE_BUCKET=<your-project>.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=<messaging-sender-id>
VITE_FIREBASE_APP_ID=<app-id>
```

#### Firebase Admin Configuration (Private)
```
FIREBASE_ADMIN_PROJECT_ID=<project-id>
FIREBASE_ADMIN_CLIENT_EMAIL=<client-email-from-service-account>
FIREBASE_ADMIN_PRIVATE_KEY=<private-key-from-service-account>
```

#### Google OAuth Configuration
```
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>
GOOGLE_REDIRECT_URI=https://your-app.vercel.app/api/auth/google/callback
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

#### Encryption Key
```
ENCRYPTION_KEY=<generate-32-byte-hex-key>
```

Generate encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Optional: Telegram Bot (if using Telegram features)
```
TELEGRAM_BOT_TOKEN=<your-telegram-bot-token>
TELEGRAM_WEBHOOK_SECRET=<random-secret-key>
```

#### Optional: Gmail Pub/Sub
```
GMAIL_PUBSUB_TOPIC=projects/<project-id>/topics/gmail-notifications
GMAIL_PUBSUB_SUBSCRIPTION=projects/<project-id>/subscriptions/gmail-notifications
```

#### Optional: Gemini AI
```
GEMINI_API_KEY=<your-gemini-api-key>
```

### 3.3 Deploy

1. Click **Deploy**
2. Wait for build to complete
3. Visit your deployed app at `https://your-app.vercel.app`

## Phase 4: Post-Deployment Verification

### 4.1 Test Authentication Flow

1. Navigate to your app
2. Click **Sign in with Google**
3. Verify popup opens (not redirect)
4. Complete Google OAuth
5. Should redirect to onboarding

### 4.2 Verify Firestore Access

1. Go to Firebase Console → **Firestore Database**
2. Check that a new user document was created under `users/{uid}`
3. Verify it contains all required fields:
   - `uid`, `email`, `displayName`, `createdAt`
   - `onboardingComplete: false`, `botState: "idle"`

### 4.3 Test Onboarding

1. Complete the onboarding wizard
2. Verify:
   - Google Drive folder is created
   - Default profile is created
   - User document is updated with `onboardingComplete: true`

### 4.4 Monitor Logs

```bash
# View Vercel logs
vercel logs

# View Firebase logs
firebase functions:log
```

## Phase 5: Production Optimization

### 5.1 Enable Caching

Add to `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }
      ]
    }
  ]
}
```

### 5.2 Set Up Monitoring

1. Enable **Application Performance Monitoring** in Firebase
2. Set up alerts for errors and latency
3. Monitor Vercel Analytics

### 5.3 Configure Custom Domain

1. In Vercel project settings → **Domains**
2. Add your custom domain
3. Update DNS records as instructed
4. Update Firebase authorized domains

### 5.4 Enable HTTPS

- Vercel automatically provides HTTPS with SSL certificate
- Ensure all OAuth redirect URIs use `https://`

## Troubleshooting

### Issue: "Popup blocked" on login

**Solution**: Ensure `GOOGLE_REDIRECT_URI` and `NEXT_PUBLIC_APP_URL` match your Vercel domain exactly.

### Issue: "Unauthorized" errors in Firestore

**Solution**: Verify Firebase Admin credentials are correct:
```bash
# Test connection
node << 'EOF'
const admin = require('firebase-admin');
const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_PRIVATE_KEY_JSON);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
admin.firestore().collection('users').limit(1).get().then(() => {
  console.log('✓ Connected');
}).catch(err => console.error('✗ Error:', err));
EOF
```

### Issue: "Invalid OAuth credentials"

**Solution**: 
1. Verify Client ID and Secret in Google Cloud Console
2. Check redirect URI matches exactly (including protocol)
3. Regenerate credentials if needed

### Issue: Slow initial load

**Solution**:
1. Enable Vercel Analytics to identify bottleneck
2. Check Firebase cold start times
3. Consider upgrading Firebase plan

## Rollback Procedure

If deployment fails:

```bash
# Revert to previous deployment
vercel rollback

# Or manually deploy previous version
git checkout <previous-commit>
vercel deploy --prod
```

## Maintenance Schedule

- **Weekly**: Monitor error logs and performance metrics
- **Monthly**: Review security rules and access patterns
- **Quarterly**: Update dependencies and security patches
- **Annually**: Review and optimize database schema

## Support & Documentation

- [Vercel Docs](https://vercel.com/docs)
- [Firebase Docs](https://firebase.google.com/docs)
- [Google OAuth Docs](https://developers.google.com/identity/protocols/oauth2)
- [Firestore Rules](https://firebase.google.com/docs/firestore/security/start)

## Checklist

- [ ] Firebase project created
- [ ] Firestore database deployed
- [ ] Service account created
- [ ] Google OAuth credentials configured
- [ ] All environment variables set in Vercel
- [ ] Vercel deployment successful
- [ ] Authentication flow tested
- [ ] Firestore documents created
- [ ] Onboarding completed successfully
- [ ] Custom domain configured (if applicable)
- [ ] Monitoring and alerts set up
- [ ] Backup strategy implemented
