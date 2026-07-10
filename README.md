# Invoice Wedding Web

React + Vite + Tailwind CSS application for the Invoice Wedding PRD. The implementation target uses Firebase Authentication and Firestore.

## Phase 1 Scope

- Vite React TypeScript project initialized.
- Tailwind CSS configured through the Vite plugin.
- Firebase client wiring prepared through environment variables.
- Scalable folder structure created.
- Reusable UI components created.
- Placeholder pages created for public, vendor, and Super Admin areas.
- README and `.env.example` added.

## Phase 2 Scope

- Firebase client initialization uses `VITE_*` environment variables only.
- Firebase Email/Password login and vendor registration are wired.
- Manual first Super Admin bootstrap is supported for `VITE_SUPERADMIN_EMAIL`.
- Protected routes enforce `super_admin` and `user` roles.
- Firestore collection names are centralized in `src/constants/firestore.ts`.
- Local `firestore.rules` and `firebase.json` are included for review before deployment.

## Tech Stack

- React
- Vite
- TypeScript
- Tailwind CSS
- Firebase Authentication
- Firestore
- Cloudflare R2 for vendor logo storage
- Cloudflare Worker for secure R2 uploads
- React Router
- Zod and React Hook Form
- Recharts
- jsPDF, html2canvas, and xlsx

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Copy the example environment file:

```bash
cp .env.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

3. Fill the Firebase values in `.env.local` when the Firebase project is ready.

4. Start the development server:

```bash
npm run dev
```

5. Build for production:

```bash
npm run build
```

## Environment Variables

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_APP_URL=http://localhost:5173
VITE_SUPERADMIN_EMAIL=idhamdjuanda@gmail.com
```

Do not commit real Firebase credentials or private service account keys.

Cloudflare R2 uploads use a Cloudflare Worker, because Firebase Spark/free cannot run Cloud Functions. The React app calls the Worker URL through:

```env
VITE_R2_LOGO_API_URL=
```

Configure the Worker in `cloudflare-worker/wrangler.toml`, bind the `invoice-files` R2 bucket as `INVOICE_FILES`, and set:

```env
FIREBASE_PROJECT_ID=kuitansi---invoice
FIREBASE_API_KEY=
```

Uploaded logos are stored in R2 and served back through the Worker URL, so the R2 bucket itself does not need to be public.

Vendor logo uploads store the binary file in R2. Firestore only stores:

```json
{
  "logoUrl": "string | null",
  "logoKey": "string | null"
}
```

### Automatic token reminders

The same Cloudflare Worker runs every day at 08:00 WIB and sends token expiry reminders at H-7, H-3, and H-1. Add these values as Worker secrets, never to the React `.env.local` file:

```text
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_TOKEN_REMINDER_TEMPLATE
```

Optional Worker variables:

```text
WHATSAPP_TEMPLATE_LANGUAGE=id
WHATSAPP_GRAPH_API_VERSION=v23.0
```

Create an approved WhatsApp template whose body contains one parameter for the remaining day count, for example:

```text
Halo, masa aktif Invoice Vendor Anda akan berakhir dalam {{1}} hari.

Silakan lakukan perpanjangan token agar aplikasi tetap dapat digunakan.

Terima kasih.
```

The Firebase service account must be allowed to read `users` and `businessProfiles` and write `tokenReminderLogs`. Vendors without a WhatsApp number are skipped without stopping reminders for other users.


## Architecture

```text
src/
  app/              Router and app-level composition
  assets/           Static app assets
  components/       Shared UI and layout components
  config/           Environment and app configuration
  constants/        Cross-feature constants
  features/         Feature modules by PRD domain
  hooks/            Shared React hooks
  lib/              Firebase client and reusable utilities
  pages/            Route-level pages
  services/         Firestore, PDF, and export adapters
  styles/           Global Tailwind CSS
  types/            Shared TypeScript domain types
```

## Manual Super Admin Bootstrap

1. Create the Super Admin account manually in Firebase Authentication.
2. Use email `idhamdjuanda@gmail.com`, or update `VITE_SUPERADMIN_EMAIL` locally before running the app.
3. If you deploy the included Firestore rules, create the document `systemConfig/bootstrap` with:

```json
{
  "superAdminEmail": "idhamdjuanda@gmail.com"
}
```

4. Log in through `/login`. The app will create the matching `users/{uid}` profile with role `super_admin` if permitted by rules.

No Firebase credentials are hardcoded into source files.

## PRD Implementation Phases

### Phase 1: Foundation

Initialize React, Vite, Tailwind, Firebase environment scaffolding, folder structure, reusable UI components, placeholder pages, and setup documentation.

### Phase 2: Firebase Auth and Activation

Implement Firebase Email/Password auth, Super Admin bootstrap strategy, vendor registration with activation token validation in Firestore, protected routes, role checks, and expired/suspended account guards.

### Phase 3: Super Admin

Build Super Admin dashboard, activation token generation, token filters, user list, user detail, suspend, reactivate, soft delete, and audit logging.

### Phase 4: Vendor Profile and Packages

Implement business profile, bank account text fields, package CRUD, package ownership checks, and package soft-delete/inactive rules.

### Phase 5: Invoice Core

Implement clients, multi-event invoice form, package selection with price snapshots, discount calculation, public slug generation, Firestore transaction-safe invoice numbering, invoice list, detail, edit, and public toggle.

### Phase 6: Payments and Receipts

Implement payment history, payment validation, invoice status recalculation, automatic receipt creation, Firestore transaction-safe receipt numbering, receipt detail, and receipt PDF hooks.

### Phase 7: PDF and Public Invoice

Implement invoice PDF, receipt PDF, public invoice page by random slug, public PDF download, QR WhatsApp vendor, and public data minimization.

### Phase 8: WhatsApp and Reminders

Implement Indonesian phone normalization, invoice WhatsApp messages, and manual reminder buttons for H-30, H-14, H-7, H-3, and H-1.

### Phase 9: Dashboard, Export, Backup

Implement vendor metrics, monthly chart, filters, CSV export, Excel export, Super Admin backup, Super Admin restore, confirmation flow, and audit logs.

### Phase 10: QA and Deploy Readiness

Verify responsiveness, security rules, role isolation, Firestore transaction paths, PDF fallbacks, manual acceptance criteria, and production build.
