import { Link } from "react-router";

import type { Overview } from "../api";
import { useRead } from "../use";

export function OverviewPage() {
  const { data, error } = useRead<Overview>("/api/overview");
  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;
  const f = data.figures;
  return (
    <>
      <h1>{data.company}</h1>
      <section aria-label="Headline figures" className="figures">
        <Figure label="Shipments" value={f.shipments} />
        <Figure label="In transit" value={f.in_transit} to="/shipments?status=in%20transit" />
        <Figure label="Delayed" value={f.delayed} to="/shipments?status=delayed" />
        <Figure label="On time" value={`${f.on_time}%`} />
      </section>
      <div className="two">
        <section aria-labelledby="delays-h" className="card">
          <h2 id="delays-h">Delays by port</h2>
          <ul className="bars">
            {data.delays_by_port.map((p) => (
              <li key={p.port}>
                <span>{p.port}</span>
                <span className="bar" style={{ width: `${p.delayed * 18}px` }} />
                <span className="n">{p.delayed}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card">
          <h2>Recent shipments</h2>
          <table>
            <tbody>
              {data.recent.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>
                    {s.from} → {s.to}
                  </td>
                  <td>
                    <span className={`pill ${s.status.replace(" ", "-")}`}>{s.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}

function Figure({ label, value, to }: { label: string; value: number | string; to?: string }) {
  const body = (
    <>
      <span className="figure-value">{value}</span>
      <span className="figure-label">{label}</span>
    </>
  );
  return to ? (
    <Link to={to} className="figure" aria-label={`${label}: ${value}`}>
      {body}
    </Link>
  ) : (
    <div className="figure">{body}</div>
  );
}
