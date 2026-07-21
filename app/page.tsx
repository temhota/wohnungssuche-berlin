type Apartment = {
  id: number;
  title: string;
  address: string;
  rooms: number;
  area: number;
  warmRent: number;
  coldRent: number;
  wbs: string | null;
  published: string;
  features: string[];
  href: string;
};

const apartments: Apartment[] = [
  {
    id: 1,
    title: "3-Zimmer-Wohnung mit Balkon",
    address: "Eidechsenweg 5, 13591 Berlin",
    rooms: 3,
    area: 71.67,
    warmRent: 1110.89,
    coldRent: 873.41,
    wbs: "WBS 160/180/220",
    published: "vor 4 Min.",
    features: ["Balkon", "Aufzug", "Neubau"],
    href: "https://www.wbm.de/wohnungen-berlin/angebote/",
  },
  {
    id: 2,
    title: "Helle Wohnung in Lichtenberg",
    address: "Möllendorffstraße, 10367 Berlin",
    rooms: 2,
    area: 54.2,
    warmRent: 842,
    coldRent: 651,
    wbs: null,
    published: "vor 12 Min.",
    features: ["Loggia", "Keller", "Fernwärme"],
    href: "https://www.howoge.de/immobiliensuche/wohnungssuche.html",
  },
  {
    id: 3,
    title: "Erstbezug nahe der Dahme",
    address: "Am Falkenberg, 12524 Berlin",
    rooms: 4,
    area: 98.18,
    warmRent: 1794.73,
    coldRent: 1374.52,
    wbs: null,
    published: "vor 27 Min.",
    features: ["Erstbezug", "Aufzug", "Park"],
    href: "https://www.degewo.de/wohnung-finden",
  },
  {
    id: 4,
    title: "Kompakte Wohnung mit guter Anbindung",
    address: "Residenzstraße, 13409 Berlin",
    rooms: 1,
    area: 39.8,
    warmRent: 649,
    coldRent: 492,
    wbs: "WBS 100",
    published: "vor 39 Min.",
    features: ["Einbauküche", "Badewanne"],
    href: "https://www.gewobag.de/fuer-mietinteressentinnen/mietangebote/",
  },
  {
    id: 5,
    title: "Familienwohnung in Pankow",
    address: "Hauptstraße, 13158 Berlin",
    rooms: 3,
    area: 76.4,
    warmRent: 1188,
    coldRent: 905,
    wbs: null,
    published: "vor 1 Std.",
    features: ["Balkon", "Spielplatz", "Keller"],
    href: "https://www.gesobau.de/mieten/wohnungssuche/",
  },
  {
    id: 6,
    title: "Ruhige Wohnung mit Terrasse",
    address: "Buckower Damm, 12349 Berlin",
    rooms: 2,
    area: 61.3,
    warmRent: 931,
    coldRent: 712,
    wbs: "WBS 140",
    published: "vor 2 Std.",
    features: ["Terrasse", "Barrierearm"],
    href: "https://stadtundland.de/wohnungssuche",
  },
];

const money = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

export default function Home() {
  return (
    <main>
      {/* <header className="topbar">
        <a className="brand" href="#top">Kiezfinder</a>
        <div className="headerMeta">
          <span>Zuletzt geprüft: gerade eben</span>
        </div>
      </header> */}

      <section className="content" id="top">
        <div className="pageHeading">
          <div>
            <h1>Wohnungsangebote</h1>
            <p>WBM, HOWOGE, degewo, Gewobag, GESOBAU und STADT UND LAND</p>
          </div>
          <span>{apartments.length} Angebote</span>
        </div>

        <div className="list">
          {apartments.map((item) => (
            <article className="card" key={item.id}>
              <div className="cardBody">
                <div className="description">
                  <span className="published">{item.published}</span>
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
                    <dt>Kaltmiete</dt>
                    <dd>{money.format(item.coldRent)}</dd>
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

        <p className="notice">
          Derzeit werden Beispieldaten angezeigt. Die realen Wohnungsangebote
          werden im nächsten Schritt angebunden.
        </p>
      </section>
    </main>
  );
}
