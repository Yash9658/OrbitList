import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { SiteHeader } from "../../components/common/site-header";

export function PublicLayout() {
  const location = useLocation();
  const routeKey = `${location.pathname}${location.search}`;

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant"
    });
  }, [routeKey]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1260px] px-4 py-6 sm:px-6 lg:px-8" key={routeKey}>
        <Outlet />
      </main>
    </div>
  );
}
