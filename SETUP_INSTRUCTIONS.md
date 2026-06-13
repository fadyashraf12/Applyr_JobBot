# Applyr JobBot - Complete Setup Instructions

Welcome to Applyr! This document provides everything you need to get started with the application.

## 🚀 Quick Start (5 minutes)

### Local Development

```bash
# 1. Clone the repository
git clone https://github.com/fadyashraf12/Applyr_JobBot.git
cd Applyr_JobBot

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local

# 4. Start development server
npm run dev

# 5. Open http://localhost:5173
```

## 📋 Prerequisites

Before you begin, you'll need:

- **Node.js 18+** - [Download](https://nodejs.org/)
- **npm or yarn** - Comes with Node.js
- **Firebase Account** - [Create free account](https://firebase.google.com/)
- **Google Cloud Project** - [Create project](https://console.cloud.google.com/)
- **Vercel Account** (for deployment) - [Sign up free](https://vercel.com/)
- **GitHub Account** - [Create account](https://github.com/)

## 🔧 Environment Setup

### Step 1: Create `.env.local` File

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

### Step 2: Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project named `applyr-production`
3. Go to **Project Settings** → **General**
4. Copy your Firebase config and add to `.env.local`:

```
VITE_FIREBASE_API_KEY=<your-api-key>
VITE_FIREBASE_AUTH_DOMAIN=<your-project>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<your-project-id>
VITE_FIREBASE_STORAGE_BUCKET=<your-bucket>
VITE_FIREBASE_MESSAGING_SENDER_ID=<your-sender-id>
VITE_FIREBASE_APP_ID=<your-app-id>
```

### Step 3: Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials:
   - Type: Web Application
   - Authorized redirect URIs:
     - `http://localhost:5173/api/auth/google/callback`
     - `https://your-app.vercel.app/api/auth/google/callback`

3. Add to `.env.local`:

```
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>
GOOGLE_REDIRECT_URI=http://localhost:5173/api/auth/google/callback
NEXT_PUBLIC_APP_URL=http://localhost:5173
```

### Step 4: Firebase Admin SDK

1. Go to **Project Settings** → **Service Accounts**
2. Generate new private key (JSON)
3. Extract these values and add to `.env.local`:

```
FIREBASE_ADMIN_PROJECT_ID=<project-id>
FIREBASE_ADMIN_CLIENT_EMAIL=<client-email>
FIREBASE_ADMIN_PRIVATE_KEY=<private-key>
```

### Step 5: Encryption Key

Generate a secure encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add to `.env.local`:

```
ENCRYPTION_KEY=<your-generated-key>
```

## 📁 Project Structure

```
Applyr_JobBot/
├── src/
│   ├── components/          # React components
│   │   ├── auth/           # Login page
│   │   ├── dashboard/      # Dashboard components
│   │   ├── onboarding/     # Onboarding wizard
│   │   ├── vault/          # Cloud vault
│   │   ├── profiles/       # CV profiles
│   │   ├── crm/            # Application tracking
│   │   └── ui/             # Reusable UI components
│   ├── lib/
│   │   ├── firebase/       # Firebase config & helpers
│   │   ├── google/         # Google APIs integration
│   │   ├── auth/           # Authentication utilities
│   │   ├── ai/             # AI/Gemini integration
│   │   ├── telegram/       # Telegram bot
│   │   └── documents/      # Document processing
│   ├── server/             # Express server
│   │   ├── createApp.ts    # API routes
│   │   ├── auth.ts         # Auth middleware
│   │   ├── telegramWebhook.ts
│   │   └── gmailWebhook.ts
│   ├── types/              # TypeScript types
│   ├── App.tsx             # Main app component
│   └── main.tsx            # Entry point
├── public/                 # Static assets
├── firestore.rules         # Firestore security rules
├── vite.config.ts          # Vite configuration
├── tailwind.config.ts      # Tailwind CSS config
├── tsconfig.json           # TypeScript config
└── package.json            # Dependencies
```

## 🏃 Running the Application

### Development Mode

```bash
npm run dev
```

Starts the development server at `http://localhost:5173` with:
- Hot module reloading
- Vite dev server
- Express backend on same port

### Build for Production

```bash
npm run build
```

Creates optimized build in `dist/` directory.

### Start Production Server

```bash
npm run start
```

Runs the built application (requires `npm run build` first).

## 🔐 Authentication Flow

### New User Login

1. User clicks "Sign in with Google"
2. Popup opens to Google OAuth consent screen
3. User selects/creates Google account
4. OAuth callback creates Firebase user and initializes Firestore
5. User is redirected to onboarding

### Onboarding Process

**Step 1: Connect Google Services**
- Link Google Drive (for storing resumes)
- Link Gmail (for sending applications)

**Step 2: Create Cloud Vault**
- Create Drive folder for storing documents
- Create default "Software Engineer" profile
- Set up Gmail watch for incoming emails

### Dashboard Access

After onboarding, users can:
- View job applications dashboard
- Manage CV profiles
- Access cloud vault
- Connect Telegram bot
- Track application status

## 📊 Database Schema

### User Document (`users/{uid}`)

```javascript
{
  uid: string,
  email: string,
  displayName: string,
  createdAt: Timestamp,
  onboardingComplete: boolean,
  botState: string,
  activeProfileId: string | null,
  monitoringChannelId: string | null,
  updatedAt: Timestamp
}
```

### Google Config (`users/{uid}/config/google`)

```javascript
{
  connectedEmail: string,
  accessToken: string (encrypted),
  refreshToken: string (encrypted),
  tokenExpiry: number,
  driveConnected: boolean,
  gmailConnected: boolean,
  vaultFolderId: string,
  vaultFolderName: string,
  gmailWatchExpiry: Timestamp | null,
  gmailHistoryId: string | null
}
```

### CV Profile (`users/{uid}/profiles/{profileId}`)

```javascript
{
  profileId: string,
  name: string,
  driveFolderId: string,
  masterCvFileId: string | null,
  coverLetterTemplateFileId: string | null,
  headshotFileId: string | null,
  isActive: boolean,
  createdAt: Timestamp
}
```

### Job Application (`users/{uid}/applications/{appId}`)

```javascript
{
  applicationId: string,
  profileId: string,
  company: string,
  jobTitle: string,
  jobDescription: string,
  hrEmail: string,
  status: 'pending' | 'interview' | 'offer' | 'rejected' | 'ghosted',
  appliedAt: Timestamp,
  tailoredCvFileId: string,
  emailSubject: string,
  emailBody: string,
  notes: string,
  followUpDate: Timestamp | null,
  contacts: ContactInfo[],
  recruiterReplied: boolean,
  lastReplyAt: Timestamp | null,
  lastReplySnippet: string | null,
  sourceType: 'image' | 'text' | 'pdf'
}
```

## 🚢 Deployment to Vercel

### Step 1: Push to GitHub

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### Step 2: Connect to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Select your GitHub repository
4. Click "Import"

### Step 3: Configure Environment Variables

In Vercel project settings, add all variables from `.env.local`:

- Firebase config (public)
- Firebase Admin credentials (private)
- Google OAuth credentials
- Encryption key
- Any other secrets

### Step 4: Deploy

Click "Deploy" and wait for build to complete.

### Step 5: Update OAuth Redirect URIs

1. Go to Google Cloud Console
2. Add your Vercel domain to authorized redirect URIs:
   ```
   https://your-app.vercel.app/api/auth/google/callback
   ```

3. Update `.env.local` for local testing:
   ```
   GOOGLE_REDIRECT_URI=https://your-app.vercel.app/api/auth/google/callback
   NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
   ```

## 🧪 Testing

### Test Authentication

```bash
# 1. Start dev server
npm run dev

# 2. Navigate to http://localhost:5173
# 3. Click "Sign in with Google"
# 4. Complete OAuth flow
# 5. Should see onboarding wizard
```

### Test Firestore

```bash
# Check if user document was created
firebase firestore:get /users/{uid}
```

### Test APIs

```bash
# Health check
curl http://localhost:5173/api/health

# Get Drive files (requires auth)
curl -H "Authorization: Bearer <id-token>" \
  http://localhost:5173/api/drive/files
```

## 🐛 Troubleshooting

### Issue: "Popup blocked" on login

**Solution**: The popup might be blocked by browser. Ensure:
- You're clicking the button directly (not programmatically)
- Popup blocker is disabled for localhost
- Check browser console for errors

### Issue: "Firebase config missing"

**Solution**: Verify `.env.local` has all Firebase variables:
```bash
grep VITE_FIREBASE .env.local
```

### Issue: "Google OAuth failed"

**Solution**: Check:
1. Client ID and Secret are correct
2. Redirect URI matches exactly
3. OAuth consent screen is configured
4. Required APIs are enabled (Drive, Gmail, People)

### Issue: "Firestore permission denied"

**Solution**: 
1. Check security rules are deployed: `firebase deploy --only firestore:rules`
2. Verify user is authenticated
3. Check rules allow the operation

### Issue: "Build fails on Vercel"

**Solution**:
1. Check build logs: `vercel logs`
2. Verify all environment variables are set
3. Check TypeScript errors: `npm run lint`
4. Try local build: `npm run build`

## 📚 Documentation

- [Firestore Setup Guide](./FIRESTORE_SETUP.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Vercel Documentation](https://vercel.com/docs)

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Commit: `git commit -am 'Add feature'`
4. Push: `git push origin feature/your-feature`
5. Open a pull request

## 📝 License

This project is proprietary and confidential.

## 💬 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the documentation links
3. Check GitHub issues
4. Contact the development team

## 🎯 Next Steps

1. Complete environment setup
2. Run `npm run dev` to start development
3. Test the authentication flow
4. Complete onboarding
5. Deploy to Vercel
6. Monitor logs and metrics

Happy coding! 🚀
