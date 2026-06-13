# Applyr Production pre-deployment & post-deployment checklist

Follow this step-by-step pre-flight checklist to verify security, performance, and API integrations before going live in production.

---

## 📋 Pre-Deployment

- [ ] **No Mock Data Audit**
  - Confirmed all active pages/views bind cleanly to authenticated user collections in Firestore.
  - Confirmed and resolved any leftover `// TODO: Implement` exports or static mocks.

- [ ] **Environment Variable Alignment**
  - Verified all variables in `.env.example` match the configuration parameters inside `.env.local` or Vercel Settings.
  - Verified `X-Telegram-Bot-Api-Secret-Token` validation is set to prevent unauthorized telemetry requests.

- [ ] **Google OAuth & Consent Form Preparation**
  - Set the application redirect URI inside Google Cloud Console: `https://<your-app-domain>/api/auth/google/callback`.
  - Enforced that Google OAuth verification contains the explicit scopes requested: `Gmail Readonly + Send`, `Drive Metadata + Read + Write`.

- [ ] **Google Pub/Sub Topic Registration**
  - Created Google Cloud Pub/Sub topic for Gmail push notifications.
  - Formatted the topic name inside `GMAIL_PUBSUB_TOPIC` (e.g. `projects/<project-id>/topics/<topic-name>`).

- [ ] **Production-Ready Compilation Verification**
  - Built the application locally with zero TypeScript warnings or bundler failures (`npm run build`).

---

## 🚀 Post-Deployment

- [ ] **Register Telegram Webhook URL**
  - Register the webhook with Telegram Bot API, passing the bot token and secure webhook secret:
    ```bash
    curl -F "url=https://<your-app-domain>/api/telegram-webhook" \
         -F "secret_token=<YOUR_SECURE_WEBHOOK_SECRET>" \
         https://api.telegram.org/bot<YOUR_TELEGRAM_BOT_TOKEN>/setWebhook
    ```

- [ ] **Configure Google Cloud Pub/Sub Push Subscription**
  - Confirmed that the push subscription routes Gmail notifications straight to:
    `https://<your-app-domain>/api/api/gmail/webhook`
  - Confirmed other endpoints on Pub/Sub are secured correctly.

- [ ] **Firestore Collection Security Rules Alignment**
  - Deployed primary security rules validating that nested collections are accessible strictly by matching `request.auth.uid`.
    ```bash
    firebase deploy --only firestore:rules
    ```

- [ ] **Verify Authentication State Ingress**
  - Successfully ran `/scripts/verify-deployment.ts` or `npx tsx scripts/verify-deployment.ts` and achieved green status on all columns.
