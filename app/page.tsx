import { getListings } from "@/lib/listings";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const PAGE_SIZE = 50;

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
  const { listings, sources, fetchedAt } = await getListings();
  const params = await searchParams;
  const rawPage = params?.page;
  const requestedPage =
    typeof rawPage === "string" && /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
  const totalPages = Math.max(1, Math.ceil(listings.length / PAGE_SIZE));
  const page = Math.min(totalPages, Math.max(1, requestedPage));
  const visibleListings = listings.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );
  const connectedSources = sources.filter((source) => source.status === "ok");
  const failedSources = sources.filter((source) => source.status === "error");

  return (
    <main>
      <section className="content" id="top">
        <div className="pageHeading">
          <div>
            <h1>Wohnungsangebote</h1>
            <p>Aktuelle Angebote direkt von HOWOGE, degewo und GESOBAU</p>
          </div>
          <span>{listings.length} Angebote</span>
        </div>

        {listings.length > 0 ? (
          <div className="list">
            {visibleListings.map((item) => (
              <article className="card" key={item.id}>
                <div className="cardBody">
                  <div className="description">
                    <span className="published">
                      {item.provider}
                      {item.district ? ` · ${item.district}` : ""}
                    </span>
                    <h2>{item.title}</h2>
                    <p className="address">{item.address}</p>
                    <div className="tags">
                      {item.wbs && <span>{item.wbs}</span>}
                      {item.features.map((feature) => (
                        <span key={feature}>{feature}</span>
                      ))}
                    </div>
                  </div>

                  <dl className="facts">
                    <div>
                      <dt>Zimmer</dt>
                      <dd>{item.rooms}</dd>
                    </div>
                    <div>
                      <dt>Wohnfläche</dt>
                      <dd>{item.area.toLocaleString("de-DE")} m²</dd>
                    </div>
                    <div>
                      <dt>Warmmiete</dt>
                      <dd>{money.format(item.warmRent)}</dd>
                    </div>
                  </dl>
                </div>

                <div className="cardFooter">
                  <a href={item.href} target="_blank" rel="noreferrer">
                    Zum Angebot ↗
                  </a>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="notice">
            {failedSources.length === 0
              ? "Aktuell sind keine Wohnungsangebote verfügbar."
              : connectedSources.length === 0
                ? "Die Angebote konnten gerade nicht geladen werden."
                : "In den erreichbaren Quellen sind aktuell keine Wohnungsangebote verfügbar."}
          </p>
        )}

        {totalPages > 1 && (
          <nav className="pagination" aria-label="Seitennavigation">
            {page > 1 ? (
              <a href={`?page=${page - 1}`} rel="prev">
                ← Zurück
              </a>
            ) : (
              <span aria-disabled="true">← Zurück</span>
            )}
            <span aria-current="page">{`Seite ${page} von ${totalPages}`}</span>
            {page < totalPages ? (
              <a href={`?page=${page + 1}`} rel="next">
                Weiter →
              </a>
            ) : (
              <span aria-disabled="true">Weiter →</span>
            )}
          </nav>
        )}

        {failedSources.length > 0 && (
          <p className="notice" role="status">
            Nicht erreichbar:{" "}
            {failedSources.map((source) => source.provider).join(", ")}.
            {connectedSources.length > 0 &&
              " Die Angebotsliste ist möglicherweise unvollständig."}
          </p>
        )}

        <p className="notice">
          Quellen:{" "}
          {connectedSources
            .map((source) => `${source.provider} (${source.count})`)
            .join(", ") || "nicht erreichbar"}{" "}
          · Aktualisiert:{" "}
          {new Date(fetchedAt).toLocaleString("de-DE", {
            timeZone: "Europe/Berlin",
          })}{" "}
          (Berliner Zeit)
        </p>
      </section>
    </main>
  );
}
