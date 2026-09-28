"use client";

import { createContext, useContext, type ReactNode } from "react";
import { shouldNavigate } from "@/lib/navigation";

const NavigationContext = createContext<{
  navigate: (href: string, scroll?: boolean) => void;
}>({
  navigate: () => {},
});

export function useListingNavigation() {
  return useContext(NavigationContext);
}

export default function ListingNavigation({
  children,
  pending,
  navigate,
}: {
  children: ReactNode;
  pending: boolean;
  navigate: (href: string, scroll?: boolean) => void;
}) {
  return (
    <NavigationContext.Provider value={{ navigate }}>
      <div className="loadingStatus" role="status" aria-live="polite">
        {pending && (
          <>
            <span className="spinner" aria-hidden="true" />
            Angebote werden geladen…
          </>
        )}
      </div>
      <div aria-busy={pending}>{children}</div>
    </NavigationContext.Provider>
  );
}

export function ListingLink({
  href,
  rel,
  children,
}: {
  href: string;
  rel?: string;
  children: ReactNode;
}) {
  const { navigate } = useListingNavigation();
  return (
    <a
      href={href}
      rel={rel}
      onClick={(event) => {
        if (!shouldNavigate(event)) return;
        event.preventDefault();
        navigate(href, true);
      }}
    >
      {children}
    </a>
  );
}
