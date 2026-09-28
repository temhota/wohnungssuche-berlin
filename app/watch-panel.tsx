"use client";

import type { useListingWatch } from "./use-listing-watch";

export default function WatchPanel({
  watch,
  hasProviders,
}: {
  watch: ReturnType<typeof useListingWatch>;
  hasProviders: boolean;
}) {
  return (
    <section
      className="watchPanel"
      id="watch-panel"
      aria-label="Angebote beobachten"
    >
      <div className="watchHeading">
        <h2>Neue Angebote beobachten</h2>
        <span className={watch.enabled ? "watchActive" : ""}>
          {watch.enabled ? "Beobachtung aktiv" : "Beobachtung pausiert"}
        </span>
      </div>
      <p>
        Benachrichtigungen gelten für die angewendeten Filter. Bestehende
        Angebote lösen beim Start keinen Alarm aus.
      </p>
      <div className="filterActions">
        {watch.enabled ? (
          <button type="button" onClick={watch.stop}>
            Beobachtung stoppen
          </button>
        ) : (
          <button type="button" disabled={!hasProviders} onClick={watch.start}>
            Beobachtung starten
          </button>
        )}
        <button
          type="button"
          className="resetFilters"
          onClick={() => void watch.playSound()}
        >
          Ton testen
        </button>
      </div>
      <p className="watchHint">
        Tab geöffnet lassen. Neue Quelldaten werden etwa alle 2 Minuten
        abgerufen; Hintergrund-Tabs und der Ruhemodus können Prüfungen
        verzögern.
      </p>
      {!hasProviders && (
        <p>Bitte mindestens eine Website auswählen und die Filter anwenden.</p>
      )}
      <div className="watchMessages" role="status">
        {watch.lastCheck && (
          <p>Letzter Abruf: {watch.lastCheck} (Berliner Zeit)</p>
        )}
        {watch.soundStatus && <p>{watch.soundStatus}</p>}
        {watch.notificationStatus && <p>{watch.notificationStatus}</p>}
        {watch.storageStatus && <p>{watch.storageStatus}</p>}
        {watch.newListings.length > 0 && (
          <p>
            {watch.newListings.length} neue passende Angebote seit dem Start.
          </p>
        )}
      </div>
      {watch.newListings.length > 0 && (
        <ul className="watchResults">
          {watch.newListings.slice(0, 10).map((item) => (
            <li key={item.id}>
              <a href={item.href} target="_blank" rel="noreferrer">
                {item.provider} · {item.address} ·{" "}
                {item.warmRent.toLocaleString("de-DE")} € warm ↗
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
