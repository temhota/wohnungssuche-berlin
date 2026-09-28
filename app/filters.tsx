import { PROVIDERS, type Filters } from "@/lib/listings/filters";

export default function ListingFilters({
  filters,
  districts,
}: {
  filters: Filters;
  districts: string[];
}) {
  return (
    <form className="filters" action="/" method="get">
      <input type="hidden" name="sources" value="selected" />
      <div className="filterGrid">
        <fieldset>
          <legend>Bezirke / Ortsteile</legend>
          <p className="filterHint">
            Ohne Auswahl: alle. Angaben laut Anbieter.
          </p>
          <div className="districtOptions">
            {districts.map((district) => (
              <label className="checkOption" key={district}>
                <input
                  type="checkbox"
                  name="district"
                  value={district}
                  defaultChecked={filters.districts.includes(district)}
                />
                {district}
              </label>
            ))}
            {districts.length === 0 && (
              <span className="filterHint">
                Keine Bezirksangaben verfügbar.
              </span>
            )}
          </div>
        </fieldset>
        <fieldset>
          <legend>Websites</legend>
          {PROVIDERS.map((provider) => (
            <label className="checkOption" key={provider}>
              <input
                type="checkbox"
                name="provider"
                value={provider}
                defaultChecked={filters.providers.includes(provider)}
              />
              {provider}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Warmmiete (€)</legend>
          <div className="rangeInputs">
            <label>
              Von
              <input
                type="number"
                name="minRent"
                min="0"
                step="0.01"
                defaultValue={filters.minRent}
              />
            </label>
            <label>
              Bis
              <input
                type="number"
                name="maxRent"
                min="0"
                step="0.01"
                defaultValue={filters.maxRent}
              />
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Wohnfläche (m²)</legend>
          <div className="rangeInputs">
            <label>
              Von
              <input
                type="number"
                name="minArea"
                min="0"
                step="0.01"
                defaultValue={filters.minArea}
              />
            </label>
            <label>
              Bis
              <input
                type="number"
                name="maxArea"
                min="0"
                step="0.01"
                defaultValue={filters.maxArea}
              />
            </label>
          </div>
        </fieldset>
      </div>
      <label className="checkOption">
        <input
          type="checkbox"
          name="excludeWbs"
          value="1"
          defaultChecked={filters.excludeWbs}
        />
        Angebote mit WBS-Pflicht ausschließen
      </label>
      <div className="filterActions">
        <button type="submit">Filter anwenden</button>
        {/* A full navigation resets unsaved values in this uncontrolled form. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/">Zurücksetzen</a>
      </div>
    </form>
  );
}
