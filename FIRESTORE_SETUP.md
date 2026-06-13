# Firestore Database Setup Guide

This guide provides complete instructions for setting up and initializing your Firestore database for the Applyr JobBot application.

## Overview

The Applyr application uses Firestore as its primary database. The database schema is organized around user-centric data structures with the following main collections:

- **users/{uid}** - Root user profile documents
- **users/{uid}/config/google** - Encrypted Google OAuth tokens and connection status
- **users/{uid}/profiles/{profileId}** - CV profile configurations
- **users/{uid}/applications/{appId}** - Job application tracking records
- **users/{uid}/drafts/{draftId}** - In-progress application packages
- **users/{uid}/botSession/current** - Telegram bot conversation state
- **telegram_mappings/{telegramUserId}** - Telegram user to Firebase UID mapping (server-only)
- **pairing_tokens/{token}** - Short-lived authentication tokens (server-only)

## Step 1: Create Firestore Database

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (e.g., `applyr-production`)
3. Navigate to **Firestore Database** in the left sidebar
4. Click **Create Database**
5. Choose **Start in production mode** (security rules will protect it)
6. Select your preferred region (e.g., `us-central1`)
7. Click **Create**

## Step 2: Deploy Security Rules

The security rules ensure that:
- Users can only read/write their own data
- Server-side operations (Telegram mappings, pairing tokens) are protected
- All data is encrypted end-to-end

Deploy the rules using the Firebase CLI:

```bash
# Install Firebase CLI if you haven't already
npm install -g firebase-tools

# Login to Firebase
firebase login

# Deploy Firestore rules
firebase deploy --only firestore:rules
```

Or manually in the Firebase Console:

1. Go to **Firestore Database** → **Rules** tab
2. Copy the contents of `firestore.rules` from the repository
3. Paste into the rules editor
4. Click **Publish**

## Step 3: Verify Database Schema

The database will be automatically initialized when users sign up. Here's what happens:

### On Initial Login (via `/api/auth/google/callback` with `login_flow`):

The server automatically creates:

```javascript
// Root user document
users/{uid} = {
  uid: string,
  email: string,
  displayName: string,
  createdAt: Timestamp,
  onboardingComplete: false,
  botState: "idle",
  activeProfileId: null,
  monitoringChannelId: null,
  updatedAt: Timestamp
}

// Google configuration
users/{uid}/config/google = {
  connectedEmail: string,
  accessToken: string (encrypted),
  refreshToken: string (encrypted),
  tokenExpiry: number,
  driveConnected: true,
  gmailConnected: false
}
```

### On Onboarding Completion (via `/api/onboarding/create-vault`):

```javascript
// Vault folder reference
users/{uid}/config/google = {
  ...previous fields,
  vaultFolderId: string,
  vaultFolderName: string
}

// Default profile
users/{uid}/profiles/software_engineer_default = {
  profileId: "software_engineer_default",
  name: "Software Engineer",
  driveFolderId: string,
  masterCvFileId: null,
  coverLetterTemplateFileId: null,
  headshotFileId: null,
  isActive: true,
  createdAt: Timestamp
}

// Active profile reference
users/{uid} = {
  ...previous fields,
  activeProfileId: "software_engineer_default"
}
```

## Step 4: Enable Firestore Indexes (if needed)

Firestore will automatically suggest composite indexes for complex queries. When you first run queries:

1. Check the browser console for index creation links
2. Click the links to create indexes automatically, OR
3. Go to **Firestore Database** → **Indexes** and create manually

## Step 5: Configure Firestore Emulator (Local Development)

For local testing without affecting production:

```bash
# Install Firestore emulator
firebase setup:emulators:firestore

# Start the emulator
firebase emulators:start --only firestore

# In your code, connect to the emulator:
# Set environment variable: FIREBASE_EMULATOR_HOST=localhost:8080
```

## Step 6: Verify Environment Variables

Ensure these are set in your Vercel deployment:

```
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=your-service-account-email
FIREBASE_ADMIN_PRIVATE_KEY=your-service-account-private-key
```

Get these from Firebase Console → Project Settings → Service Accounts → Generate new private key

## Data Validation & Constraints

### User Document Constraints:
- `uid`: Must match Firebase Auth UID (immutable)
- `email`: Must be valid email format
- `onboardingComplete`: Boolean flag
- `botState`: One of: `idle`, `awaiting_input`, `processing`
- `activeProfileId`: References a profile document ID or null

### Google Config Constraints:
- `accessToken` & `refreshToken`: AES-256-GCM encrypted
- `tokenExpiry`: Unix timestamp in milliseconds
- `driveConnected` & `gmailConnected`: Boolean flags

### Application Document Constraints:
- `status`: One of: `pending`, `interview`, `offer`, `rejected`, `ghosted`
- `appliedAt`: Must be a valid Timestamp
- `hrEmail`: Must be valid email format

## Backup & Recovery

### Enable Automated Backups:

1. Go to **Firestore Database** → **Backups**
2. Click **Create Schedule**
3. Set frequency (e.g., daily)
4. Choose retention period (e.g., 30 days)

### Manual Backup:

```bash
# Export Firestore data
gcloud firestore export gs://your-bucket/backup-$(date +%s)

# Import Firestore data
gcloud firestore import gs://your-bucket/backup-timestamp
```

## Monitoring & Maintenance

### Check Database Size:

1. Go to **Firestore Database** → **Usage**
2. Monitor storage and read/write operations

### Common Issues:

| Issue | Solution |
|-------|----------|
| "Permission denied" errors | Check Firestore rules and user authentication |
| Slow queries | Create composite indexes (Firestore will suggest) |
| High costs | Review read/write patterns, consider caching |
| Data not syncing | Verify network connectivity and Firebase config |

## Security Best Practices

1. **Never expose private keys** - Use Firebase Admin SDK only on server
2. **Encrypt sensitive data** - Use AES-256-GCM for tokens
3. **Validate all inputs** - Server-side validation is mandatory
4. **Use security rules** - Enforce access control at database level
5. **Monitor access** - Enable Cloud Audit Logs
6. **Rotate credentials** - Regenerate service account keys periodically

## Testing Database Connectivity

```bash
# Test from Node.js
node << 'EOF'
const admin = require('firebase-admin');
const serviceAccount = require('./path/to/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
db.collection('users').limit(1).get().then(snap => {
  console.log('✓ Firestore connected successfully');
  console.log(`Found ${snap.size} documents`);
}).catch(err => {
  console.error('✗ Firestore connection failed:', err);
});
EOF
```

## Next Steps

1. Deploy Firestore rules: `firebase deploy --only firestore:rules`
2. Set environment variables in Vercel
3. Test authentication flow on staging
4. Monitor database usage in Firebase Console
5. Set up automated backups

For more information, visit the [Firebase Firestore Documentation](https://firebase.google.com/docs/firestore).
