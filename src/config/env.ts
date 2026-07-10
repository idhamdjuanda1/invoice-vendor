export const env = {
  appUrl: import.meta.env.VITE_APP_URL ?? 'http://localhost:5173',
  superAdminEmail: import.meta.env.VITE_SUPERADMIN_EMAIL ?? '',
  r2LogoApiUrl: import.meta.env.VITE_R2_LOGO_API_URL ?? '',
  vendorNotificationApiUrl: import.meta.env.VITE_VENDOR_NOTIFICATION_API_URL ?? '',
  firebase: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
  },
}
