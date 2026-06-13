# Applyr — AI-Driven Job Application Auto-Pilot

Applyr is a high-performance, edge-ready SaaS platform that automates the job seeking pipeline. It tailoring CV credentials, registers documents under Google Drive, automates correspondence, and processes applications asynchronously, backed by a Telegram companion bot and Gmail real-time tracker hooks.

---

## 🛠️ Prerequisites

Before getting started, make sure you have the following prerequisites ready:
- **Node.js**: `v18.x` or higher (recommended `v20+`)
- **Google Cloud Platform (GCP) Console Account**: For configuring Gmail and Drive APIs via OAuth.
- **Firebase Project Account**: For authenticating users (Firebase Auth) and storage of accounts data (Firestore).
- **Telegram Bot Token**: Generate an API token via bot father (@BotFather) in Telegram.
- **Gemini AI Developer Key**: From Google AI Studio (e.g., Gemini API keys).

---

## 🔑 Environment Variables Reference

Create a `.env.local` file at the root of the project. Here is the list of configuration parameters required, organized by logic groups:

| Group | Variable | Description |
|---|---|---|
| **Telegram Bot** | `TELEGRAM_BOT_TOKEN` | Unique authentication token for your Telegram companion bot. |
| | `TELEGRAM_WEBHOOK_SECRET` | Secret token used to validate incoming Telegram webhook calls. |
| **Google Console API** | `NEXT_PUBLIC_APP_URL` | Root URL of your deployed application (e.g. `https://applyr.vercel.app`). |
| | `GMAIL_PUBSUB_TOPIC` | Resource name of GCloud Pub/Sub topic for webhook alerts (`projects/<id>/topics/<name>`). |
| **Gemini AI Engine** | `GEMINI_API_KEY` | Secret credentials to interact with model agents in the background. |
| **Firebase Client SDK** | `NEXT_PUBLIC_FIREBASE_API_KEY` | API key to initialize user sessions on the client side. |
| | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase authorization domain endpoint. |
| | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firestore/Auth project identification descriptor. |
| **Firebase Server SDK** | `FIREBASE_ADMIN_PROJECT_ID` | Project ID for Admin SDK authorization steps. |
| | `FIREBASE_ADMIN_CLIENT_EMAIL` | Service Account email address with Firestore Admin clearances. |
| | `FIREBASE_ADMIN_PRIVATE_KEY` | Multiline private key private segment, with newline characters (`\nMII...`). |

---

## 💻 Local Development

Follow these steps to instantiate and run the developer container environment locally:

1. **Install Dependencies**
   ```bash
   npm install
   ```
2. **Configure Environment Constants**
   Copy `.env.example` to `.env.local` and populate secrets:
   ```bash
   cp .env.example .env.local
   ```
3. **Execute the Dev Server**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` to launch the Applyr Console.

---

## 🔒 Deploying Database Collection Security Rules

Enforce safe Firestore rules to prevent reading/writing of data across boundaries:
```bash
# Deploys security rules cleanly using Firebase CLI tools
firebase deploy --only firestore:rules
```

---

## 🤖 Webhooks Setup

### 1. Telegram Bot Webhook Integration
To link Telegram updates, execute the following script locally to bind your production webhook:
```bash
curl -F "url=https://<your-app-domain>/api/telegram-webhook" \
     -F "secret_token=<YOUR_SECURE_WEBHOOK_SECRET>" \
     https://api.telegram.org/bot<YOUR_TELEGRAM_BOT_TOKEN>/setWebhook
```

### 2. Gmail Pub/Sub Push Subscription Configuration
Configure real-time change-detection tracking notifications:
1. Establish a **Google Cloud Pub/Sub Topic** under GCP console.
2. Grant publisher permissions to the official Gmail system account: `gmail-api-push@system.gserviceaccount.com`.
3. Create a **Push Subscription** tied to this topic. Set the endpoint delivery target URL to:
   `https://<your-app-domain>/api/gmail/webhook`

---

## 🛸 Deploying to Vercel

1. Log in to your Vercel profile workspace.
2. Connect your repository tree and click **Import Project**.
3. Under **Environment Variables**, translate all attributes listed inside your local `.env.local` file.
4. Hit **Deploy**. Vercel will bundle and spin the application live at your custom domain!
