# Applyr Deployment Guide

This guide will walk you through setting up everything needed to deploy Applyr to Vercel.

---

## STEP 1: Firebase Setup (Your Database)

Your Firestore project `applyr-production` is already created. Now you need to get the credentials.

### 1.1 Get Firebase Client Credentials

1. Go to: https://console.firebase.google.com/project/applyr-production/settings/general
2. Scroll down to "Your apps" section
3. If no app exists, click "Add app" > Web (</>)
4. Copy these values:
   - **apiKey** → This is `NEXT_PUBLIC_FIREBASE_API_KEY`
   - **authDomain** → This is `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - **projectId** → This is `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - **storageBucket** → This is `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - **messagingSenderId** → This is `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - **appId** → This is `NEXT_PUBLIC_FIREBASE_APP_ID`

### 1.2 Enable Google Authentication in Firebase

1. Go to: https://console.firebase.google.com/project/applyr-production/authentication/providers
2. Click "Sign-in method" tab
3. Click "Google" and enable it
4. Add your domain later (after Vercel deployment)

### 1.3 Get Firebase Admin SDK Credentials

1. Go to: https://console.firebase.google.com/project/applyr-production/settings/serviceaccounts/adminsdk
2. Click "Generate new private key"
3. A JSON file will download - open it
4. Copy these values:
   - **project_id** → This is `FIREBASE_ADMIN_PROJECT_ID`
   - **client_email** → This is `FIREBASE_ADMIN_CLIENT_EMAIL`
   - **private_key** → This is `FIREBASE_ADMIN_PRIVATE_KEY` (include the full key with \n characters)

---

## STEP 2: Google Cloud Setup (For Drive & Gmail API)

### 2.1 Create Google OAuth Client

1. Go to: https://console.cloud.google.com/apis/credentials?project=applyr-production
2. Click "+ CREATE CREDENTIALS" > "OAuth client ID"
3. Choose "Web application"
4. Name it "Applyr Web App"
5. Under "Authorized redirect URIs", add:
   - `https://your-app-name.vercel.app/api/auth/google/callback`
   - (Replace `your-app-name` with your actual Vercel app name)
6. Click "Create"
7. Copy:
   - **Client ID** → This is `GOOGLE_CLIENT_ID`
   - **Client Secret** → This is `GOOGLE_CLIENT_SECRET`

### 2.2 Enable Required Google APIs

1. Go to: https://console.cloud.google.com/apis/library?project=applyr-production
2. Search for and enable these APIs:
   - **Google Drive API**
   - **Gmail API**

### 2.3 Configure OAuth Consent Screen

1. Go to: https://console.cloud.google.com/apis/consent?project=applyr-production
2. Click "Configure Consent Screen"
3. Choose "External" user type
4. Fill in required fields (App name, support email)
5. Add scopes:
   - `https://www.googleapis.com/auth/drive.file`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.modify`

---

## STEP 3: Telegram Bot Setup

1. Open Telegram and search for **@BotFather**
2. Send the command: `/newbot`
3. Follow the prompts to name your bot
4. BotFather will give you a **token** like `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`
5. Save this token as `TELEGRAM_BOT_TOKEN`

### Generate a Webhook Secret

Create a random secret string (at least 20 characters) for `TELEGRAM_WEBHOOK_SECRET`. Example: `mySuperSecretWebhookKey2024!`

---

## STEP 4: Gmail Real-time Notifications (Optional but Recommended)

### 4.1 Create Pub/Sub Topic

1. Go to: https://console.cloud.google.com/cloudpubsub/topic/list?project=applyr-production
2. Click "CREATE TOPIC"
3. Name it: `gmail-notifications`
4. Click "CREATE"

### 4.2 Grant Gmail Permission

1. Open the topic you just created
2. Click "PERMISSIONS" tab
3. Click "ADD PRINCIPAL"
4. Add this email: `gmail-api-push@system.gserviceaccount.com`
5. Role: "Pub/Sub Publisher"
6. Click "SAVE"

### 4.3 Create Push Subscription

1. Open your topic and click "CREATE SUBSCRIPTION"
2. Subscription ID: `gmail-push-sub`
3. Delivery type: "Push"
4. Endpoint URL: `https://your-app-name.vercel.app/api/gmail/webhook`
5. Click "CREATE"

The `GMAIL_PUBSUB_TOPIC` value is: `projects/applyr-production/topics/gmail-notifications`

---

## STEP 5: Gemini AI Setup

1. Go to: https://aistudio.google.com/apikey
2. Click "Create API key"
3. Copy the key as `GEMINI_API_KEY`

---

## STEP 6: Generate Encryption Key

Create a random 32+ character string for `ENCRYPTION_SECRET_KEY`. This is used to encrypt your OAuth tokens.

Example: `MySecureEncryptionKey2024ApplyrSecret!32chars`

---

## STEP 7: Deploy to Vercel

### 7.1 Push Code to GitHub

1. Create a new repository on GitHub
2. Push your code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

### 7.2 Connect Vercel

1. Go to: https://vercel.com
2. Click "Add New" > "Project"
3. Import your GitHub repository
4. Configure settings:
   - Framework Preset: **Other**
   - Build Command: `npm run build`
   - Output Directory: `dist`

### 7.3 Add Environment Variables

In Vercel dashboard, go to Settings > Environment Variables and add ALL of these:

| Variable | Value |
|----------|-------|
| NEXT_PUBLIC_FIREBASE_API_KEY | (from Step 1.1) |
| NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN | applyr-production.firebaseapp.com |
| NEXT_PUBLIC_FIREBASE_PROJECT_ID | applyr-production |
| NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET | applyr-production.firebasestorage.app |
| NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID | (from Step 1.1) |
| NEXT_PUBLIC_FIREBASE_APP_ID | (from Step 1.1) |
| NEXT_PUBLIC_APP_URL | https://your-app-name.vercel.app |
| FIREBASE_ADMIN_PROJECT_ID | applyr-production |
| FIREBASE_ADMIN_CLIENT_EMAIL | (from Step 1.3) |
| FIREBASE_ADMIN_PRIVATE_KEY | (the full private key with \n) |
| GOOGLE_CLIENT_ID | (from Step 2.1) |
| GOOGLE_CLIENT_SECRET | (from Step 2.1) |
| GOOGLE_REDIRECT_URI | https://your-app-name.vercel.app/api/auth/google/callback |
| TELEGRAM_BOT_TOKEN | (from Step 3) |
| TELEGRAM_WEBHOOK_SECRET | (your random secret) |
| GMAIL_PUBSUB_TOPIC | projects/applyr-production/topics/gmail-notifications |
| GEMINI_API_KEY | (from Step 5) |
| ENCRYPTION_SECRET_KEY | (your 32+ char random string) |

### 7.4 Deploy

Click "Deploy" and wait for the build to complete.

---

## STEP 8: Post-Deployment Setup

### 8.1 Update Firebase Authorized Domains

1. Go to: https://console.firebase.google.com/project/applyr-production/authentication/settings
2. Add your Vercel domain to "Authorized domains"

### 8.2 Update Google OAuth Redirect URIs

1. Go to: https://console.cloud.google.com/apis/credentials?project=applyr-production
2. Edit your OAuth client
3. Add your Vercel URL to authorized redirect URIs

### 8.3 Register Telegram Webhook

After deployment, run this command (replace values):

```bash
curl -F "url=https://your-app-name.vercel.app/api/telegram-webhook" \
     -F "secret_token=YOUR_TELEGRAM_WEBHOOK_SECRET" \
     https://api.telegram.org/botYOUR_TELEGRAM_BOT_TOKEN/setWebhook
```

### 8.4 Deploy Firestore Security Rules

```bash
firebase deploy --only firestore:rules
```

---

## Quick Reference: All Environment Variables

| Variable | Description |
|----------|-------------|
| NEXT_PUBLIC_FIREBASE_API_KEY | Firebase client API key |
| NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN | Firebase auth domain |
| NEXT_PUBLIC_FIREBASE_PROJECT_ID | Firebase project ID |
| NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET | Firebase storage bucket |
| NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID | Firebase messaging sender ID |
| NEXT_PUBLIC_FIREBASE_APP_ID | Firebase app ID |
| NEXT_PUBLIC_APP_URL | Your deployed app URL |
| FIREBASE_ADMIN_PROJECT_ID | Admin SDK project ID |
| FIREBASE_ADMIN_CLIENT_EMAIL | Admin SDK client email |
| FIREBASE_ADMIN_PRIVATE_KEY | Admin SDK private key (full) |
| GOOGLE_CLIENT_ID | Google OAuth client ID |
| GOOGLE_CLIENT_SECRET | Google OAuth client secret |
| GOOGLE_REDIRECT_URI | OAuth callback URL |
| TELEGRAM_BOT_TOKEN | Bot token from BotFather |
| TELEGRAM_WEBHOOK_SECRET | Random secret for webhook verification |
| GMAIL_PUBSUB_TOPIC | Pub/Sub topic for Gmail notifications |
| GEMINI_API_KEY | Gemini AI API key |
| ENCRYPTION_SECRET_KEY | 32+ char random string for token encryption |

---

## Need Help?

If you encounter issues:
1. Check Vercel deployment logs
2. Verify all environment variables are set correctly
3. Make sure Firebase and Google Cloud APIs are enabled
4. Check that OAuth consent screen is configured
