import { type ComponentType, type LazyExoticComponent, Suspense, lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import { PublicLayout } from "../layouts/public-layout";
import { RouteErrorPage } from "./route-error-page";
import { ProtectedRoute } from "./protected-route";
import { Card } from "../../components/ui/card";

const HomePage = lazy(async () => {
  const module = await import("../../pages/home/home-page");
  return { default: module.HomePage };
});

const MarketplacePage = lazy(async () => {
  const module = await import("../../pages/marketplace/marketplace-page");
  return { default: module.MarketplacePage };
});

const ListingDetailPage = lazy(async () => {
  const module = await import("../../pages/listing-detail/listing-detail-page");
  return { default: module.ListingDetailPage };
});

const PricingPage = lazy(async () => {
  const module = await import("../../pages/pricing/pricing-page");
  return { default: module.PricingPage };
});

const LoginPage = lazy(async () => {
  const module = await import("../../pages/auth/login-page");
  return { default: module.LoginPage };
});

const DashboardPage = lazy(async () => {
  const module = await import("../../pages/dashboard/dashboard-page");
  return { default: module.DashboardPage };
});

const CreateListingPage = lazy(async () => {
  const module = await import("../../pages/listings/create-listing-page");
  return { default: module.CreateListingPage };
});

const EditListingPage = lazy(async () => {
  const module = await import("../../pages/listings/edit-listing-page");
  return { default: module.EditListingPage };
});

const MessagesPage = lazy(async () => {
  const module = await import("../../pages/messages/messages-page");
  return { default: module.MessagesPage };
});
const TransactionsPage = lazy(async () => {
  const module = await import("../../pages/transactions/transactions-page");
  return { default: module.TransactionsPage };
});
const TransactionDetailPage = lazy(async () => {
  const module = await import("../../pages/transactions/transaction-detail-page");
  return { default: module.TransactionDetailPage };
});
const TransactionSuccessPage = lazy(async () => {
  const module = await import("../../pages/transactions/transaction-success-page");
  return { default: module.TransactionSuccessPage };
});
const TransactionCancelPage = lazy(async () => {
  const module = await import("../../pages/transactions/transaction-cancel-page");
  return { default: module.TransactionCancelPage };
});

const ConversationPage = lazy(async () => {
  const module = await import("../../pages/messages/conversation-page");
  return { default: module.ConversationPage };
});

const WatchlistPage = lazy(async () => {
  const module = await import("../../pages/watchlist/watchlist-page");
  return { default: module.WatchlistPage };
});

const NotificationsPage = lazy(async () => {
  const module = await import("../../pages/notifications/notifications-page");
  return { default: module.NotificationsPage };
});
const SettingsPage = lazy(async () => {
  const module = await import("../../pages/settings/settings-page");
  return { default: module.SettingsPage };
});
const BillingPage = lazy(async () => {
  const module = await import("../../pages/billing/billing-page");
  return { default: module.BillingPage };
});
const BillingSuccessPage = lazy(async () => {
  const module = await import("../../pages/billing/billing-success-page");
  return { default: module.BillingSuccessPage };
});
const BillingCancelPage = lazy(async () => {
  const module = await import("../../pages/billing/billing-cancel-page");
  return { default: module.BillingCancelPage };
});
const VerificationPage = lazy(async () => {
  const module = await import("../../pages/verification/verification-page");
  return { default: module.VerificationPage };
});
const AdminVerificationPage = lazy(async () => {
  const module = await import("../../pages/verification/admin-verification-page");
  return { default: module.AdminVerificationPage };
});
const AdminPaymentsPage = lazy(async () => {
  const module = await import("../../pages/admin/admin-payments-page");
  return { default: module.AdminPaymentsPage };
});
const AdminListingsPage = lazy(async () => {
  const module = await import("../../pages/admin/admin-listings-page");
  return { default: module.AdminListingsPage };
});
const AdminReportsPage = lazy(async () => {
  const module = await import("../../pages/admin/admin-reports-page");
  return { default: module.AdminReportsPage };
});
const AdminAuditLogsPage = lazy(async () => {
  const module = await import("../../pages/admin/admin-audit-logs-page");
  return { default: module.AdminAuditLogsPage };
});
const AdminDisputesPage = lazy(async () => {
  const module = await import("../../pages/admin/admin-disputes-page");
  return { default: module.AdminDisputesPage };
});
const AdminIdentityPage = lazy(async () => {
  const module = await import("../../pages/admin/admin-identity-page");
  return { default: module.AdminIdentityPage };
});

function RouteLoadingState() {
  return (
    <section className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <Card className="max-w-xl p-8 text-center">
        <span className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
          Loading
        </span>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em]">Preparing page</h1>
        <p className="mt-3 text-muted-foreground">
          Bringing the next part of the marketplace into view.
        </p>
      </Card>
    </section>
  );
}

function lazyElement(Component: LazyExoticComponent<ComponentType>) {
  return (
    <Suspense fallback={<RouteLoadingState />}>
      <Component />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <PublicLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: lazyElement(HomePage) },
      { path: "marketplace", element: lazyElement(MarketplacePage) },
      { path: "listing/:slug", element: lazyElement(ListingDetailPage) },
      { path: "pricing", element: lazyElement(PricingPage) },
      { path: "login", element: lazyElement(LoginPage) }
    ]
  },
  {
    path: "/",
    element: <ProtectedRoute />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        path: "dashboard",
        element: <PublicLayout />,
        children: [
          { index: true, element: lazyElement(DashboardPage) },
          { path: "listings/new", element: lazyElement(CreateListingPage) },
          { path: "listings/:id/edit", element: lazyElement(EditListingPage) },
          { path: "verification", element: lazyElement(VerificationPage) }
        ]
      },
      {
        path: "messages",
        element: <PublicLayout />,
        children: [
          { index: true, element: lazyElement(MessagesPage) },
          { path: ":id", element: lazyElement(ConversationPage) }
        ]
      },
      {
        path: "transactions",
        element: <PublicLayout />,
        children: [
          { index: true, element: lazyElement(TransactionsPage) },
          { path: ":id", element: lazyElement(TransactionDetailPage) },
          { path: "success", element: lazyElement(TransactionSuccessPage) },
          { path: "cancel", element: lazyElement(TransactionCancelPage) }
        ]
      },
      {
        path: "watchlist",
        element: <PublicLayout />,
        children: [{ index: true, element: lazyElement(WatchlistPage) }]
      },
      {
        path: "notifications",
        element: <PublicLayout />,
        children: [{ index: true, element: lazyElement(NotificationsPage) }]
      },
      {
        path: "settings",
        element: <PublicLayout />,
        children: [{ index: true, element: lazyElement(SettingsPage) }]
      },
      {
        path: "billing",
        element: <PublicLayout />,
        children: [
          { index: true, element: lazyElement(BillingPage) },
          { path: "success", element: lazyElement(BillingSuccessPage) },
          { path: "cancel", element: lazyElement(BillingCancelPage) }
        ]
      },
      {
        path: "admin/verifications",
        element: <PublicLayout />,
        children: [{ index: true, element: lazyElement(AdminVerificationPage) }]
      },
      {
        path: "admin/listings",
        element: <PublicLayout />,
        children: [{ index: true, element: lazyElement(AdminListingsPage) }]
      },
      {
        path: "admin/payments",
        element: <PublicLayout />,
        children: [{ index: true, element: lazyElement(AdminPaymentsPage) }]
      },
      {
        path: "admin/reports",
        element: <PublicLayout />,
        children: [{ index: true, element: lazyElement(AdminReportsPage) }]
      },
      {
        path: "admin/audit-logs",
        element: <PublicLayout />,
        children: [{ index: true, element: lazyElement(AdminAuditLogsPage) }]
      },
      {
        path: "admin/disputes",
        element: <PublicLayout />,
        children: [{ index: true, element: lazyElement(AdminDisputesPage) }]
      },
      {
        path: "admin/identity",
        element: <PublicLayout />,
        children: [{ index: true, element: lazyElement(AdminIdentityPage) }]
      }
    ]
  }
]);
