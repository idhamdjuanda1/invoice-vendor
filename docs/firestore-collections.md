# Firestore Collections

This project uses Firestore collections that map the PRD's Prisma-style schema into Firebase documents. Document references and exact query indexes will be finalized feature-by-feature.

## Core Collections

- `users`: Firebase Auth profile mirror, role, activation state, suspend state, expiry, soft delete marker.
- `activationTokens`: Super Admin-created activation tokens. The document ID is the token code so registration can validate an exact token without listing all tokens.
- `businessProfiles`: Vendor business identity, WhatsApp number, address, business description, and bank account text fields.
- `bankAccounts`: Vendor payment accounts.
- `packages`: Vendor package catalog with category, price, active state, and soft delete marker.
- `clients`: Vendor client records.
- `invoiceSequences`: Per-vendor monthly invoice counters.
- `receiptSequences`: Per-vendor monthly receipt counters.
- `invoices`: Invoice header, totals, payment status, public slug, public link state.
- `invoiceItems`: Invoice package/item snapshots.
- `invoiceEvents`: One or more event records per invoice.
- `payments`: Payment history per invoice.
- `receipts`: Automatically generated receipt records.
- `backupLogs`: Backup and restore records.
- `auditLogs`: Important security and data-change events.
- `systemConfig`: Manual bootstrap metadata, including the first Super Admin email if the provided rules are deployed.

## Role Values

- `super_admin`
- `user`

## Manual Super Admin Bootstrap

1. Create the first Super Admin account manually in Firebase Authentication with email `idhamdjuanda@gmail.com`.
2. If deploying the included `firestore.rules`, create `systemConfig/bootstrap` manually in Firestore before the first login:

```json
{
  "superAdminEmail": "idhamdjuanda@gmail.com"
}
```

3. Log in through the app with the Super Admin Firebase Auth account.
4. The app attempts to create `users/{uid}` with role `super_admin` when the email matches `VITE_SUPERADMIN_EMAIL`.

If the rules are not deployed yet, you can alternatively create `users/{uid}` manually with:

```json
{
  "uid": "<firebase-auth-uid>",
  "name": "Super Admin",
  "email": "idhamdjuanda@gmail.com",
  "role": "super_admin",
  "isActive": true,
  "isSuspended": false,
  "activatedAt": "<server timestamp>",
  "activationExpiresAt": null,
  "activationTokenId": null,
  "deletedAt": null,
  "createdAt": "<server timestamp>",
  "updatedAt": "<server timestamp>"
}
```

## Destructive Changes

Do not delete collections or deploy rules that remove access paths without explicit approval. User deletion should be soft delete through `deletedAt` per PRD.
