import { useParams } from "react-router";

import type { Doc } from "../api";
import { useRead } from "../use";

export function Document() {
  const { id = "" } = useParams();
  const { data, error } = useRead<Doc>(`/api/documents/${encodeURIComponent(id)}`);
  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;
  return (
    <>
      <h1>{data.title}</h1>
      <section aria-label="Bill of lading" className="card doc">
        {data.lines.map((l, i) => (
          <p key={i} className="line">
            {l}
          </p>
        ))}
      </section>
      <p>
        <a href={`/api/documents/${data.id}/pdf`} className="button">
          Download PDF
        </a>
      </p>
    </>
  );
}
