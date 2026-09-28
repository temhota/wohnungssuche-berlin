"use client";

import { useEffect, useRef, useState } from "react";
import { parseFilters, type SearchParams } from "@/lib/listings/filters";
import { mergeResults, providersToRefresh } from "@/lib/listings/client-data";
import type { ListingResult } from "@/lib/listings/types";
import ListingNavigation from "./listing-navigation";
import ListingsView from "./listings-view";

function readParams(search: string): SearchParams {
  const query = new URLSearchParams(search);
  return Object.fromEntries(
    [...new Set(query.keys())].map((key) => {
      const values = query.getAll(key);
      return [key, values.length === 1 ? values[0] : values];
    }),
  );
}

export default function ListingsBrowser({
  initialParams,
  initialResult,
}: {
  initialParams: SearchParams;
  initialResult: ListingResult;
}) {
  const [params, setParams] = useState(initialParams);
  const [result, setResult] = useState(initialResult);
  const [pending, setPending] = useState(false);
  const resultRef = useRef(initialResult);
  const attempts = useRef(new Map<string, number>());
  const selected = parseFilters(params).providers.join(",");

  useEffect(() => {
    const onPopState = () => setParams(readParams(window.location.search));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const requestAttempts = attempts.current;
    let active = true;
    let busy = false;
    let requested: string[] = [];
    const controller = new AbortController();
    const providers = selected ? selected.split(",") : [];
    async function refresh() {
      if (busy || document.visibilityState === "hidden") return;
      const now = Date.now();
      const needed = providersToRefresh(
        resultRef.current,
        providers,
        now,
      ).filter(
        (provider) => now - (requestAttempts.get(provider) ?? 0) >= 15_000,
      );
      if (needed.length === 0) return;
      busy = true;
      requested = needed;
      needed.forEach((provider) => requestAttempts.set(provider, now));
      setPending(true);
      try {
        const query = new URLSearchParams();
        needed.forEach((provider) => query.append("provider", provider));
        const response = await fetch(`/api/listings?${query}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok && response.status !== 502)
          throw new Error("Aktualisierung fehlgeschlagen");
        const incoming: ListingResult = await response.json();
        if (active) {
          resultRef.current = mergeResults(resultRef.current, incoming);
          setResult(resultRef.current);
        }
      } catch {
        if (active) {
          resultRef.current = mergeResults(resultRef.current, {
            listings: [],
            sources: needed.map((provider) => ({
              provider,
              status: "error",
              count: 0,
              error: "Aktualisierung fehlgeschlagen",
            })),
            fetchedAt: new Date().toISOString(),
          });
          setResult(resultRef.current);
        }
      } finally {
        busy = false;
        if (active) setPending(false);
      }
    }
    // Defer the initial refresh so the cached result can paint first.
    const initial = window.setTimeout(() => {
      setPending(false);
      void refresh();
    }, 0);
    const timer = window.setInterval(() => void refresh(), 15_000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      controller.abort();
      if (busy)
        requested.forEach((provider) => requestAttempts.delete(provider));
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [selected]);

  function navigate(href: string, scroll = false) {
    const url = new URL(href, window.location.href);
    window.history.pushState(null, "", url.pathname + url.search);
    setParams(readParams(url.search));
    if (scroll) window.scrollTo({ top: 0, behavior: "instant" });
  }

  return (
    <ListingNavigation pending={pending} navigate={navigate}>
      <ListingsView params={params} result={result} />
    </ListingNavigation>
  );
}
