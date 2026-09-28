"use client";

import { useEffect, useRef, useState } from "react";
import type { Filters } from "@/lib/listings/filters";
import type { Listing, ListingResult } from "@/lib/listings/types";
import {
  createWatchState,
  observeListings,
  readSeen,
  writeSeen,
  syncWatchProviders,
  restartWatch,
} from "@/lib/watch/tracker";

export function useListingWatch(result: ListingResult, filters: Filters) {
  const [enabled, setEnabled] = useState(false);
  const running = useRef(false);
  const tracker = useRef(createWatchState());
  const audio = useRef<AudioContext | null>(null);
  const [soundStatus, setSoundStatus] = useState("");
  const [notificationStatus, setNotificationStatus] = useState("");
  const [storageStatus, setStorageStatus] = useState("");
  const [newListings, setNewListings] = useState<Listing[]>([]);
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const activation = useRef(0);
  const selected = filters.providers.join(",");
  useEffect(() => {
    syncWatchProviders(tracker.current, selected ? selected.split(",") : []);
  }, [selected]);

  useEffect(
    () => () => {
      running.current = false;
      activation.current++;
      void audio.current?.close().catch(() => {});
      audio.current = null;
    },
    [],
  );

  function loadHistory() {
    try {
      const history = readSeen(window.localStorage);
      if (!history.available)
        setStorageStatus(
          "Der Verlauf kann nicht gelesen werden. Duplikatschutz gilt nur für diese Sitzung.",
        );
      return history.seen;
    } catch {
      setStorageStatus("Der Verlauf ist nur in dieser Sitzung verfügbar.");
      return new Set<string>();
    }
  }
  function persist() {
    try {
      const saved = readSeen(window.localStorage).seen;
      for (const id of tracker.current.seen) saved.add(id);
      if (!writeSeen(window.localStorage, saved))
        throw new Error("Storage unavailable");
    } catch {
      setStorageStatus(
        "Der Verlauf kann nicht gespeichert werden. Duplikatschutz gilt nur für diese Sitzung.",
      );
    }
  }
  async function prepareAudio() {
    if (!audio.current || audio.current.state === "closed")
      audio.current = new AudioContext();
    if (audio.current.state !== "running") await audio.current.resume();
    if (audio.current.state !== "running") throw new Error("Audio blocked");
    return audio.current;
  }
  async function playSound(expectedActivation?: number) {
    try {
      const context = await prepareAudio();
      if (
        expectedActivation !== undefined &&
        (!running.current || activation.current !== expectedActivation)
      )
        return;
      const oscillator = context.createOscillator();
      const volume = context.createGain();
      oscillator.frequency.value = 880;
      volume.gain.setValueAtTime(0.08, context.currentTime);
      volume.gain.exponentialRampToValueAtTime(
        0.001,
        context.currentTime + 0.45,
      );
      oscillator.connect(volume);
      volume.connect(context.destination);
      oscillator.onended = () => {
        oscillator.disconnect();
        volume.disconnect();
      };
      oscillator.start();
      oscillator.stop(context.currentTime + 0.45);
      setSoundStatus(
        "Ton ist aktiviert. Die Lautstärke wird über dein Gerät geregelt.",
      );
    } catch {
      setSoundStatus(
        "Ton ist blockiert oder nicht verfügbar. Bitte „Ton testen“ anklicken.",
      );
    }
  }
  function start() {
    const currentActivation = ++activation.current;
    tracker.current = restartWatch(
      tracker.current,
      result,
      filters.providers,
      loadHistory(),
    );
    persist();
    setNewListings([]);
    setLastCheck(null);
    running.current = true;
    setEnabled(true);
    // Both APIs are activated directly by the user's click, before any await.
    void prepareAudio()
      .then(() => setSoundStatus("Ton ist aktiviert."))
      .catch(() =>
        setSoundStatus("Ton ist blockiert. Bitte „Ton testen“ anklicken."),
      );
    if (!("Notification" in window) || !window.isSecureContext) {
      setNotificationStatus(
        "Systembenachrichtigungen sind hier nicht verfügbar. Meldungen erscheinen auf dieser Seite.",
      );
    } else {
      const permission =
        Notification.permission === "default"
          ? Notification.requestPermission()
          : Promise.resolve(Notification.permission);
      void permission
        .then((value) => {
          if (activation.current !== currentActivation) return;
          setNotificationStatus(
            value === "granted"
              ? "Systembenachrichtigungen sind erlaubt."
              : "Systembenachrichtigungen sind nicht erlaubt. Ton und Hinweise auf dieser Seite bleiben verfügbar.",
          );
        })
        .catch(() =>
          setNotificationStatus(
            "Systembenachrichtigungen sind nicht verfügbar. Hinweise erscheinen auf dieser Seite.",
          ),
        );
    }
  }
  function stop() {
    running.current = false;
    activation.current++;
    setEnabled(false);
  }
  function observe(incoming: ListingResult) {
    if (!running.current) return;
    // Keep each active tab's baseline independent: another tab may use different filters.
    const found = observeListings(tracker.current, incoming, filters);
    persist();
    setLastCheck(
      new Date().toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin" }),
    );
    if (found.length === 0) return;
    setNewListings((previous) => [...found, ...previous]);
    void playSound(activation.current);
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        const notification = new Notification(
          found.length === 1
            ? "Neue passende Wohnung"
            : `${found.length} neue passende Wohnungen`,
          {
            body:
              found.length === 1
                ? `${found[0].provider} · ${found[0].area} m² · ${found[0].warmRent.toLocaleString("de-DE")} € warm\n${found[0].address}`
                : "Öffne Kiezfinder, um die neuen Angebote anzusehen.",
            tag: "kiezfinder-new-listings",
          },
        );
        notification.onclick = () => {
          window.focus();
          document.getElementById("watch-panel")?.scrollIntoView();
          notification.close();
        };
        notification.onerror = () =>
          setNotificationStatus(
            "Die Systembenachrichtigung konnte nicht angezeigt werden. Neue Angebote stehen unten.",
          );
      } catch {
        setNotificationStatus(
          "Systembenachrichtigungen sind hier nicht verfügbar. Neue Angebote stehen unten.",
        );
      }
    }
  }
  return {
    enabled,
    start,
    stop,
    playSound,
    observe,
    newListings,
    lastCheck,
    soundStatus,
    notificationStatus,
    storageStatus,
  };
}
