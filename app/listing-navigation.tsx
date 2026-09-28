"use client";

import {
  createContext,
  useContext,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation.js";
import { shouldNavigate } from "@/lib/navigation";

const NavigationContext = createContext<{
  pending: boolean;
  navigate: (href: string, scroll?: boolean) => void;
}>({
  pending: false,
  navigate: () => {},
});

export function useListingNavigation() {
  return useContext(NavigationContext);
}

export default function ListingNavigation({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function navigate(href: string, scroll = false) {
    if (pending) return;
    startTransition(() => router.push(href, { scroll }));
  }
  return (
    <NavigationContext.Provider value={{ pending, navigate }}>
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
  const { pending, navigate } = useListingNavigation();
  return (
    <a
      href={href}
      rel={rel}
      aria-disabled={pending || undefined}
      onClick={(event) => {
        if (!shouldNavigate(event)) return;
        event.preventDefault();
        if (!pending) navigate(href, true);
      }}
    >
      {children}
    </a>
  );
}
