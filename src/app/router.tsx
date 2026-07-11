import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AuthLayout } from '../components/layout/AuthLayout'
import { DashboardLayout } from '../components/layout/DashboardLayout'
import { PublicLayout } from '../components/layout/PublicLayout'
import { ProtectedRoute } from '../features/auth/ProtectedRoute'

function lazyNamed<T extends ComponentType<object>>(loader: () => Promise<Record<string, T>>, exportName: string) {
  return lazy(async () => {
    const module = await loader()
    return { default: module[exportName] }
  })
}

function withPageFallback(page: ReactNode) {
  return (
    <Suspense fallback={<div className="rounded-md border border-app-border bg-white p-5 text-sm text-neutral-500">Memuat halaman...</div>}>
      {page}
    </Suspense>
  )
}

const AccountingDashboardPage = lazyNamed(() => import('../pages/accounting/AccountingDashboardPage'), 'AccountingDashboardPage')
const AdminBackupPage = lazyNamed(() => import('../pages/admin/AdminBackupPage'), 'AdminBackupPage')
const AdminDashboardPage = lazyNamed(() => import('../pages/admin/AdminDashboardPage'), 'AdminDashboardPage')
const AdminTokenPage = lazyNamed(() => import('../pages/admin/AdminTokenPage'), 'AdminTokenPage')
const AdminUserDetailPage = lazyNamed(() => import('../pages/admin/AdminUserDetailPage'), 'AdminUserDetailPage')
const AdminUsersPage = lazyNamed(() => import('../pages/admin/AdminUsersPage'), 'AdminUsersPage')
const LoginPage = lazyNamed(() => import('../pages/auth/LoginPage'), 'LoginPage')
const RegisterPage = lazyNamed(() => import('../pages/auth/RegisterPage'), 'RegisterPage')
const FreelanceJobDetailPage = lazyNamed(() => import('../pages/freelance/FreelanceJobDetailPage'), 'FreelanceJobDetailPage')
const FreelanceJobsPage = lazyNamed(() => import('../pages/freelance/FreelanceJobsPage'), 'FreelanceJobsPage')
const FreelanceProfilePage = lazyNamed(() => import('../pages/freelance/FreelanceProfilePage'), 'FreelanceProfilePage')
const NotFoundPage = lazyNamed(() => import('../pages/NotFoundPage'), 'NotFoundPage')
const FreelanceActivatePage = lazyNamed(() => import('../pages/public/FreelanceActivatePage'), 'FreelanceActivatePage')
const PublicClientFormPage = lazyNamed(() => import('../pages/public/PublicClientFormPage'), 'PublicClientFormPage')
const PublicInvoicePage = lazyNamed(() => import('../pages/public/PublicInvoicePage'), 'PublicInvoicePage')
const PublicPricelistPage = lazyNamed(() => import('../pages/public/PublicPricelistPage'), 'PublicPricelistPage')
const AgreementDetailPage = lazyNamed(() => import('../pages/vendor/AgreementDetailPage'), 'AgreementDetailPage')
const AgreementsPage = lazyNamed(() => import('../pages/vendor/AgreementsPage'), 'AgreementsPage')
const DashboardPage = lazyNamed(() => import('../pages/vendor/DashboardPage'), 'DashboardPage')
const EditorDashboardPage = lazyNamed(() => import('../pages/vendor/EditorDashboardPage'), 'EditorDashboardPage')
const ExportPage = lazyNamed(() => import('../pages/vendor/ExportPage'), 'ExportPage')
const FreelancerDetailPage = lazyNamed(() => import('../pages/vendor/FreelancerDetailPage'), 'FreelancerDetailPage')
const FreelancersPage = lazyNamed(() => import('../pages/vendor/FreelancersPage'), 'FreelancersPage')
const InvoiceCreatePage = lazyNamed(() => import('../pages/vendor/InvoiceCreatePage'), 'InvoiceCreatePage')
const InvoiceDetailPage = lazyNamed(() => import('../pages/vendor/InvoiceDetailPage'), 'InvoiceDetailPage')
const InvoiceEditPage = lazyNamed(() => import('../pages/vendor/InvoiceEditPage'), 'InvoiceEditPage')
const InvoicesPage = lazyNamed(() => import('../pages/vendor/InvoicesPage'), 'InvoicesPage')
const PackagesPage = lazyNamed(() => import('../pages/vendor/PackagesPage'), 'PackagesPage')
const PartnerReportsPage = lazyNamed(() => import('../pages/vendor/PartnerReportsPage'), 'PartnerReportsPage')
const PartnersPage = lazyNamed(() => import('../pages/vendor/PartnersPage'), 'PartnersPage')
const PaymentsPage = lazyNamed(() => import('../pages/vendor/PaymentsPage'), 'PaymentsPage')
const PricelistCreatePage = lazyNamed(() => import('../pages/vendor/PricelistCreatePage'), 'PricelistCreatePage')
const PricelistsPage = lazyNamed(() => import('../pages/vendor/PricelistsPage'), 'PricelistsPage')
const ProfilePage = lazyNamed(() => import('../pages/vendor/ProfilePage'), 'ProfilePage')
const ReceiptDetailPage = lazyNamed(() => import('../pages/vendor/ReceiptDetailPage'), 'ReceiptDetailPage')
const ReceiptsPage = lazyNamed(() => import('../pages/vendor/ReceiptsPage'), 'ReceiptsPage')

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: withPageFallback(<LoginPage />) },
      { path: '/register', element: withPageFallback(<RegisterPage />) },
    ],
  },
  {
    element: (
      <ProtectedRoute allowedRoles={['user']}>
        <DashboardLayout role="vendor" />
      </ProtectedRoute>
    ),
    children: [
      { path: '/dashboard', element: withPageFallback(<DashboardPage />) },
      { path: '/profile', element: withPageFallback(<ProfilePage />) },
      { path: '/packages', element: withPageFallback(<PackagesPage />) },
      { path: '/partners', element: withPageFallback(<PartnersPage />) },
      { path: '/partner-reports', element: withPageFallback(<PartnerReportsPage />) },
      { path: '/freelancers', element: withPageFallback(<FreelancersPage />) },
      { path: '/freelancers/:freelancerId', element: withPageFallback(<FreelancerDetailPage />) },
      { path: '/editor', element: withPageFallback(<EditorDashboardPage />) },
      { path: '/invoices', element: withPageFallback(<InvoicesPage />) },
      { path: '/invoices/new', element: withPageFallback(<InvoiceCreatePage />) },
      { path: '/invoices/:invoiceId', element: withPageFallback(<InvoiceDetailPage />) },
      { path: '/invoices/:invoiceId/edit', element: withPageFallback(<InvoiceEditPage />) },
      { path: '/payments', element: withPageFallback(<PaymentsPage />) },
      { path: '/receipts', element: withPageFallback(<ReceiptsPage />) },
      { path: '/receipts/:receiptId', element: withPageFallback(<ReceiptDetailPage />) },
      { path: '/agreements', element: withPageFallback(<AgreementsPage />) },
      { path: '/agreements/:agreementId', element: withPageFallback(<AgreementDetailPage />) },
      { path: '/pricelists', element: withPageFallback(<PricelistsPage />) },
      { path: '/pricelists/new', element: withPageFallback(<PricelistCreatePage />) },
      { path: '/pricelists/:pricelistId/edit', element: withPageFallback(<PricelistCreatePage />) },
      { path: '/export', element: withPageFallback(<ExportPage />) },
    ],
  },
  {
    element: (
      <ProtectedRoute allowedRoles={['user', 'freelance']} requiredFreelanceRole="ACCOUNTING">
        <DashboardLayout role="accounting" />
      </ProtectedRoute>
    ),
    children: [
      { path: '/accounting', element: withPageFallback(<AccountingDashboardPage />) },
    ],
  },
  {
    element: (
      <ProtectedRoute allowedRoles={['super_admin']}>
        <DashboardLayout role="admin" />
      </ProtectedRoute>
    ),
    children: [
      { path: '/admin', element: withPageFallback(<AdminDashboardPage />) },
      { path: '/admin/tokens', element: withPageFallback(<AdminTokenPage />) },
      { path: '/admin/users', element: withPageFallback(<AdminUsersPage />) },
      { path: '/admin/users/:userId', element: withPageFallback(<AdminUserDetailPage />) },
      { path: '/admin/backup', element: withPageFallback(<AdminBackupPage />) },
    ],
  },
  {
    element: (
      <ProtectedRoute allowedRoles={['freelance']}>
        <DashboardLayout role="freelance" />
      </ProtectedRoute>
    ),
    children: [
      { path: '/freelance', element: withPageFallback(<FreelanceJobsPage />) },
      { path: '/freelance/schedule', element: withPageFallback(<FreelanceJobsPage />) },
      { path: '/freelance/jobs', element: withPageFallback(<FreelanceJobsPage />) },
      { path: '/freelance/jobs/:invoiceId', element: withPageFallback(<FreelanceJobDetailPage />) },
      { path: '/freelance/profile', element: withPageFallback(<FreelanceProfilePage />) },
    ],
  },
  {
    element: <PublicLayout />,
    children: [
      { path: '/freelance/activate/:token', element: withPageFallback(<FreelanceActivatePage />) },
      { path: '/invoice/:slug', element: withPageFallback(<PublicInvoicePage />) },
      { path: '/form/:slug', element: withPageFallback(<PublicClientFormPage />) },
      { path: '/pricelist/:slug', element: withPageFallback(<PublicPricelistPage />) },
    ],
  },
  { path: '*', element: withPageFallback(<NotFoundPage />) },
])
