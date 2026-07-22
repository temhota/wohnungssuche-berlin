import { getListings } from "@/lib/listings";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

export default async function Home() {
  const { listings, sources, fetchedAt } = await getListings();
  const connectedSources = sources.filter((source) => source.status === "ok");

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
            {listings.map((item) => (
              <article className="card" key={item.id}>
                <div className="cardBody">
                  <div className="description">
                    <span className="published">
                      {item.provider}{item.district ? ` · ${item.district}` : ""}
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
                    <div><dt>Zimmer</dt><dd>{item.rooms}</dd></div>
                    <div><dt>Wohnfläche</dt><dd>{item.area.toLocaleString("de-DE")} m²</dd></div>
                    <div><dt>Warmmiete</dt><dd>{money.format(item.warmRent)}</dd></div>
                  </dl>
                </div>

                <div className="cardFooter">
                  <a href={item.href} target="_blank" rel="noreferrer">Zum Angebot ↗</a>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="notice">Die Angebote konnten gerade nicht geladen werden.</p>
        )}

        <p className="notice">
          Quellen: {connectedSources.map((source) => `${source.provider} (${source.count})`).join(", ") || "nicht erreichbar"} · Aktualisiert: {new Date(fetchedAt).toLocaleString("de-DE")}
        </p>
      </section>
    </main>
  );
}
