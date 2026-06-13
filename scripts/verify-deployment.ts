import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Manual parser for env file to make sure it loads all local configurations correctly
function loadEnvLocal() {
  const filePath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(filePath)) {
    console.log('⚠️ No .env.local file detected at project root.');
    return;
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const splitIdx = trimmed.indexOf('=');
    if (splitIdx === -1) return;
    const key = trimmed.substring(0, splitIdx).trim();
    let val = trimmed.substring(splitIdx + 1).trim();
    // Strip quotes if they wrap the string
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.substring(1, val.length - 1);
    }
    // Replace literal escapes for keys to retain formatting
    val = val.replace(/\\n/g, '\n');
    process.env[key] = val;
  });
}

loadEnvLocal();

async function runVerification() {
  console.log('\n🔍 Starting Applyr Production-Readiness Deployment Verification...\n');

  // 1. Env Var Check
  const requiredEnvVars = [
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_WEBHOOK_SECRET',
    'NEXT_PUBLIC_APP_URL',
    'FIREBASE_ADMIN_PROJECT_ID',
    'FIREBASE_ADMIN_CLIENT_EMAIL',
    'FIREBASE_ADMIN_PRIVATE_KEY',
    'GEMINI_API_KEY',
    'GMAIL_PUBSUB_TOPIC'
  ];

  const envResults: { variable: string; status: 'PASS' | 'FAIL'; valuePreview: string }[] = [];
  let allEnvPassed = true;

  for (const v of requiredEnvVars) {
    const val = process.env[v];
    if (val && val.trim().length > 0) {
      const preview = val.length > 15 ? val.substring(0, 8) + '...' + val.substring(val.length - 4) : val;
      envResults.push({ variable: v, status: 'PASS', valuePreview: preview });
    } else {
      envResults.push({ variable: v, status: 'FAIL', valuePreview: 'MISSING' });
      allEnvPassed = false;
    }
  }

  console.log('📋 STEP 1: Environment Variables Check:');
  console.table(envResults);

  // 2. Telegram Webhook info checkpoint
  let telegramPassed = false;
  let telegramDetails = 'Not Checked';
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (token) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
      const payload = await res.json();
      if (payload.ok) {
        telegramPassed = true;
        telegramDetails = `URL: ${payload.result.url || 'NONE'}; Pending: ${payload.result.pending_update_count}`;
      } else {
        telegramDetails = `API Error: ${payload.description || 'Unknown'}`;
      }
    } catch (err: any) {
      telegramDetails = `Network/DNS Error: ${err.message || err}`;
    }
  } else {
    telegramDetails = 'Skipped: TELEGRAM_BOT_TOKEN missing';
  }

  console.log('\n🤖 STEP 2: Telegram Webhook Configuration Verification:');
  console.log(`Status:  ${telegramPassed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Details: ${telegramDetails}\n`);

  // 3. Firestore Connection Check
  let firestorePassed = false;
  let firestoreDetails = 'Not Checked';

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    try {
      const app = getApps().length === 0
        ? initializeApp({
            credential: cert({
              projectId,
              clientEmail,
              privateKey,
            }),
          })
        : getApp();

      const db = getFirestore(app);
      // Run light meta read query
      const testCol = db.collection('pairing_tokens');
      await testCol.limit(1).get();
      firestorePassed = true;
      firestoreDetails = 'Successfully queried pairing_tokens collection metadata via Firebase Admin SDK';
    } catch (err: any) {
      firestoreDetails = `Failed: ${err.message || err}`;
    }
  } else {
    firestoreDetails = 'Skipped: Firebase Admin Credentials incomplete';
  }

  console.log('🔥 STEP 3: Firestore Database Connectivity Check:');
  console.log(`Status:  ${firestorePassed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Details: ${firestoreDetails}\n`);

  // Final Summary Table
  console.log('====================================================');
  console.log('              SUMMARY OF PRE-FLIGHT VERIFICATION    ');
  console.log('====================================================');
  console.log(`Environment Checklist:     ${allEnvPassed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Telegram Bot Connectivity: ${telegramPassed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Firestore Core Ingress:    ${firestorePassed ? '✅ PASS' : '❌ FAIL'}`);
  console.log('====================================================\n');

  if (allEnvPassed && telegramPassed && firestorePassed) {
    console.log('🚀 SYSTEM STATUS: GREEN. Fully ready for production deployment!');
    process.exit(0);
  } else {
    console.log('⚠️ SYSTEM STATUS: YELLOW/RED. Please address failures shown above before going live.');
    process.exit(1);
  }
}

runVerification().catch(err => {
  console.error('Unhandled deployment verification error:', err);
  process.exit(1);
});
