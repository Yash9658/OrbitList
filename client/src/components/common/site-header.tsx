import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, LayoutDashboard, LogOut, Menu, ShieldCheck, UserCircle } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../../app/providers/auth-provider";
import { getConversations } from "../../services/conversation.service";
import { getNotifications } from "../../services/notifications.service";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { buttonVariants } from "../ui/button";

const publicNavItems = [
  { label: "Marketplace", to: "/marketplace" },
  { label: "Pricing", to: "/pricing" }
];

const authenticatedNavItems = [
  { label: "Messages", to: "/messages" },
  { label: "Deals", to: "/transactions" },
  { label: "Watchlist", to: "/watchlist" },
  { label: "Notifications", to: "/notifications" }
];

export function SiteHeader() {
  const { isAuthenticated, logout, user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: getNotifications,
    enabled: isAuthenticated
  });
  const conversationsQuery = useQuery({
    queryKey: ["conversations"],
    queryFn: getConversations,
    enabled: isAuthenticated
  });
  const unreadCount = notificationsQuery.data?.meta?.unreadCount ?? 0;
  const conversations = Array.isArray(conversationsQuery.data)
    ? conversationsQuery.data.filter(Boolean)
    : [];
  const unreadMessagesCount = conversations.reduce(
    (sum, conversation) => sum + (conversation.unreadCount ?? 0),
    0
  );
  const navItems = isAuthenticated
    ? [
        ...publicNavItems,
        ...authenticatedNavItems,
        ...(user?.role === "ADMIN"
          ? [
              { label: "Admin", to: "/admin/listings" }
            ]
          : [])
      ]
    : publicNavItems;
  const adminItems =
    user?.role === "ADMIN"
      ? [
          { label: "Listings review", to: "/admin/listings" },
          { label: "Verification review", to: "/admin/verifications" },
          { label: "Payments", to: "/admin/payments" },
          { label: "Identity", to: "/admin/identity" },
          { label: "Reports", to: "/admin/reports" },
          { label: "Audit logs", to: "/admin/audit-logs" },
          { label: "Disputes", to: "/admin/disputes" }
        ]
      : [];

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (mobileMenuRef.current && !mobileMenuRef.current.contains(target)) {
        setIsMobileMenuOpen(false);
      }

      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setIsProfileMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
        setIsProfileMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function closeMenus() {
    setIsMobileMenuOpen(false);
    setIsProfileMenuOpen(false);
  }

  function handleLogout() {
    closeMenus();
    logout();
  }

  return (
    <header className="sticky top-0 z-30 border-b bg-background/94 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1320px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="min-w-32">
          <Link className="block font-serif text-2xl font-black leading-none tracking-[-0.08em] sm:text-3xl" to="/">
            orbitlist.
          </Link>
          <span className="mt-1 hidden text-[0.62rem] font-semibold uppercase tracking-[0.26em] text-muted-foreground sm:block">
            social marketplace
          </span>
        </div>

        <nav
          className="hidden max-w-2xl items-center gap-1 overflow-x-auto rounded-full border bg-card/70 p-1 shadow-sm xl:flex"
          aria-label="Primary"
        >
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              className={({ isActive }) =>
                cn(
                  "inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground",
                  isActive && "bg-secondary text-foreground shadow-sm"
                )
              }
              to={item.to}
            >
              <span>{item.label}</span>
              {item.to === "/messages" && unreadMessagesCount > 0 ? (
                <Badge className="h-5 min-w-5 justify-center px-1.5 text-[0.68rem]">{unreadMessagesCount}</Badge>
              ) : null}
              {item.to === "/notifications" && unreadCount > 0 ? (
                <Badge className="h-5 min-w-5 justify-center px-1.5 text-[0.68rem]">{unreadCount}</Badge>
              ) : null}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <div className="relative xl:hidden" ref={mobileMenuRef}>
                <button
                  aria-expanded={isMobileMenuOpen}
                  className="flex h-10 items-center justify-center rounded-full border bg-card px-3 text-sm font-semibold shadow-sm transition hover:bg-secondary"
                  onClick={() => setIsMobileMenuOpen((current) => !current)}
                  type="button"
                >
                  <Menu className="h-4 w-4" />
                  <span className="ml-2 hidden sm:inline">Menu</span>
                </button>
                {isMobileMenuOpen ? (
                  <div className="absolute right-0 mt-3 grid min-w-60 gap-1 rounded-2xl border bg-card p-2 shadow-[0_24px_60px_rgba(41,35,25,0.16)]">
                    {navItems.map((item) => (
                      <NavLink
                        className={({ isActive }) =>
                          cn(
                            "rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground",
                            isActive && "bg-secondary text-foreground"
                          )
                        }
                        key={item.to}
                        onClick={closeMenus}
                        to={item.to}
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                ) : null}
              </div>
              <Link className={cn(buttonVariants({ variant: "default", size: "sm" }), "hidden sm:inline-flex")} to="/dashboard">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
              <div className="relative" ref={profileMenuRef}>
                <button
                  aria-expanded={isProfileMenuOpen}
                  className="flex cursor-pointer items-center gap-3 rounded-full border bg-card px-3 py-2 text-left shadow-sm transition hover:bg-secondary"
                  onClick={() => setIsProfileMenuOpen((current) => !current)}
                  type="button"
                >
                  <UserCircle className="h-5 w-5 text-primary" />
                  <span className="hidden leading-tight sm:grid">
                    <span className="max-w-28 truncate text-sm font-semibold">
                      {user?.fullName ?? user?.email}
                    </span>
                    <small className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {user?.role}
                    </small>
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition",
                      isProfileMenuOpen && "rotate-180"
                    )}
                  />
                </button>
                {isProfileMenuOpen ? (
                  <div className="absolute right-0 mt-3 grid min-w-52 gap-1 rounded-2xl border bg-card p-2 shadow-[0_24px_60px_rgba(41,35,25,0.16)]">
                    <Link className="rounded-xl px-3 py-2 text-sm font-semibold hover:bg-secondary" onClick={closeMenus} to="/billing">
                      Billing
                    </Link>
                    <Link className="rounded-xl px-3 py-2 text-sm font-semibold hover:bg-secondary" onClick={closeMenus} to="/settings">
                      Settings
                    </Link>
                    {adminItems.length > 0 ? (
                      <>
                        <div className="my-1 border-t" />
                        <div className="px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                          Admin
                        </div>
                        {adminItems.map((item) => (
                          <Link className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-secondary" key={item.to} onClick={closeMenus} to={item.to}>
                            <ShieldCheck className="h-4 w-4 text-primary" />
                            {item.label}
                          </Link>
                        ))}
                      </>
                    ) : null}
                    <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-destructive hover:bg-red-50" onClick={handleLogout} type="button">
                      <LogOut className="h-4 w-4" />
                      Log out
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }), "hidden sm:inline-flex")} to="/login">
                Log in
              </Link>
              <Link className={buttonVariants({ size: "sm" })} to="/login?mode=signup">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
