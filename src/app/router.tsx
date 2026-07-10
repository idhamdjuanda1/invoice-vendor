import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AuthLayout } from '../components/layout/AuthLayout'
import { DashboardLayout } from '../components/layout/DashboardLayout'
import { PublicLayout } from '../components/layout/PublicLayout'
import { ProtectedRoute } from '../features/auth/ProtectedRoute'
import { AccountingDashboardPage } from '../pages/accounting/AccountingDashboardPage'
import { AdminBackupPage } from '../pages/admin/AdminBackupPage'
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage'
import { AdminTokenPage } from '../pages/admin/AdminTokenPage'
import { AdminUserDetailPage } from '../pages/admin/AdminUserDetailPage'
import { AdminUsersPage } from '../pages/admin/AdminUsersPage'
import { LoginPage } from '../pages/auth/LoginPage'
import { RegisterPage } from '../pages/auth/RegisterPage'
import { FreelanceJobDetailPage } from '../pages/freelance/FreelanceJobDetailPage'
import { FreelanceJobsPage } from '../pages/freelance/FreelanceJobsPage'
import { FreelanceProfilePage } from '../pages/freelance/FreelanceProfilePage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { FreelanceActivatePage } from '../pages/public/FreelanceActivatePage'
import { PublicInvoicePage } from '../pages/public/PublicInvoicePage'
import { PublicClientFormPage } from '../pages/public/PublicClientFormPage'
import { PublicPricelistPage } from '../pages/public/PublicPricelistPage'
import { AgreementDetailPage } from '../pages/vendor/AgreementDetailPage'
import { AgreementsPage } from '../pages/vendor/AgreementsPage'
import { DashboardPage } from '../pages/vendor/DashboardPage'
import { EditorDashboardPage } from '../pages/vendor/EditorDashboardPage'
import { ExportPage } from '../pages/vendor/ExportPage'
import { InvoiceCreatePage } from '../pages/vendor/InvoiceCreatePage'
import { InvoiceDetailPage } from '../pages/vendor/InvoiceDetailPage'
import { InvoiceEditPage } from '../pages/vendor/InvoiceEditPage'
import { InvoicesPage } from '../pages/vendor/InvoicesPage'
import { FreelancerDetailPage } from '../pages/vendor/FreelancerDetailPage'
import { FreelancersPage } from '../pages/vendor/FreelancersPage'
import { PackagesPage } from '../pages/vendor/PackagesPage'
import { PaymentsPage } from '../pages/vendor/PaymentsPage'
import { PricelistCreatePage } from '../pages/vendor/PricelistCreatePage'
import { PricelistsPage } from '../pages/vendor/PricelistsPage'
import { ProfilePage } from '../pages/vendor/ProfilePage'
import { ReceiptDetailPage } from '../pages/vendor/ReceiptDetailPage'
import { ReceiptsPage } from '../pages/vendor/ReceiptsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },
  {
    element: (
      <ProtectedRoute allowedRoles={['user']}>
        <DashboardLayout role="vendor" />
      </ProtectedRoute>
    ),
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/profile', element: <ProfilePage /> },
      { path: '/packages', element: <PackagesPage /> },
      { path: '/freelancers', element: <FreelancersPage /> },
      { path: '/freelancers/:freelancerId', element: <FreelancerDetailPage /> },
      { path: '/editor', element: <EditorDashboardPage /> },
      { path: '/invoices', element: <InvoicesPage /> },
      { path: '/invoices/new', element: <InvoiceCreatePage /> },
      { path: '/invoices/:invoiceId', element: <InvoiceDetailPage /> },
      { path: '/invoices/:invoiceId/edit', element: <InvoiceEditPage /> },
      { path: '/payments', element: <PaymentsPage /> },
      { path: '/receipts', element: <ReceiptsPage /> },
      { path: '/receipts/:receiptId', element: <ReceiptDetailPage /> },
      { path: '/agreements', element: <AgreementsPage /> },
      { path: '/agreements/:agreementId', element: <AgreementDetailPage /> },
      { path: '/pricelists', element: <PricelistsPage /> },
      { path: '/pricelists/new', element: <PricelistCreatePage /> },
      { path: '/pricelists/:pricelistId/edit', element: <PricelistCreatePage /> },
      { path: '/export', element: <ExportPage /> },
    ],
  },
  {
    element: (
      <ProtectedRoute allowedRoles={['user', 'freelance']} requiredFreelanceRole="ACCOUNTING">
        <DashboardLayout role="accounting" />
      </ProtectedRoute>
    ),
    children: [
      { path: '/accounting', element: <AccountingDashboardPage /> },
    ],
  },
  {
    element: (
      <ProtectedRoute allowedRoles={['super_admin']}>
        <DashboardLayout role="admin" />
      </ProtectedRoute>
    ),
    children: [
      { path: '/admin', element: <AdminDashboardPage /> },
      { path: '/admin/tokens', element: <AdminTokenPage /> },
      { path: '/admin/users', element: <AdminUsersPage /> },
      { path: '/admin/users/:userId', element: <AdminUserDetailPage /> },
      { path: '/admin/backup', element: <AdminBackupPage /> },
    ],
  },
  {
    element: (
      <ProtectedRoute allowedRoles={['freelance']}>
        <DashboardLayout role="freelance" />
      </ProtectedRoute>
    ),
    children: [
      { path: '/freelance', element: <FreelanceJobsPage /> },
      { path: '/freelance/schedule', element: <FreelanceJobsPage /> },
      { path: '/freelance/jobs', element: <FreelanceJobsPage /> },
      { path: '/freelance/jobs/:invoiceId', element: <FreelanceJobDetailPage /> },
      { path: '/freelance/profile', element: <FreelanceProfilePage /> },
    ],
  },
  {
    element: <PublicLayout />,
    children: [
      { path: '/freelance/activate/:token', element: <FreelanceActivatePage /> },
      { path: '/invoice/:slug', element: <PublicInvoicePage /> },
      { path: '/form/:slug', element: <PublicClientFormPage /> },
      { path: '/pricelist/:slug', element: <PublicPricelistPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
