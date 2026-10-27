import type { Report } from "../api";
import { useRead } from "../use";
import { PREVIEW } from "./preview";

export function Reports() {
  const { data, error } = useRead<{ reports: Report[] }>("/api/reports");
  if (error) return <p className="error">{error}</p>;
  return (
    <>
      <h1>Reports</h1>
      <section aria-label="Issued reports" className="card">
        <ul className="reports">
          {data?.reports.map((r) => (
            <li key={r.id}>
              <span>
                {r.name} <span className="muted">· {r.pages} pages</span>
              </span>
              <a href={`/api/reports/${r.id}/pdf`}>PDF</a>
            </li>
          ))}
        </ul>
      </section>
      <div className="card preview">
        <iframe title="Delays report preview" srcDoc={PREVIEW} />
      </div>
    </>
  );
}
