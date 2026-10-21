import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { post, type Shipment } from "../api";
import { useRead } from "../use";

const FILTERS = [
  { value: "", label: "All" },
  { value: "in transit", label: "In transit" },
  { value: "delayed", label: "Delayed" },
  { value: "delivered", label: "Delivered" },
];

export function Shipments() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const { data, error } = useRead<{ shipments: Shipment[] }>(`/api/shipments${status ? `?status=${encodeURIComponent(status)}` : ""}`);
  const [open, setOpen] = useState<Shipment | null>(null);
  return (
    <>
      <h1>Shipments</h1>
      <div role="group" aria-label="Status" className="chips">
        {FILTERS.map((f) => (
          <button key={f.value} type="button" aria-pressed={status === f.value} onClick={() => setParams(f.value ? { status: f.value } : {})}>
            {f.label}
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <section aria-label="Shipments table" className="card">
        <table>
          <thead>
            <tr>
              <th>Shipment</th>
              <th>Route</th>
              <th>Carrier</th>
              <th>Containers</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data?.shipments.map((s) => (
              <tr key={s.id} className="clickable" onClick={() => setOpen(s)}>
                <td>{s.id}</td>
                <td>
                  {s.from} → {s.to}
                </td>
                <td>{s.carrier}</td>
                <td>{s.containers}</td>
                <td>
                  <span className={`pill ${s.status.replace(" ", "-")}`}>{s.status}</span>
                  {s.delay_days > 0 && <span className="muted"> {s.delay_days} days late</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {open && <ShipmentDialog shipment={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function ShipmentDialog({ shipment, onClose }: { shipment: Shipment; onClose: () => void }) {
  const [said, setSaid] = useState("");
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="backdrop" onClick={onClose}>
      <div role="dialog" aria-label={`Shipment ${shipment.id}`} className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h2>{shipment.id}</h2>
          <button type="button" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <dl>
          <dt>Route</dt>
          <dd>
            {shipment.from} → {shipment.to}
          </dd>
          <dt>Carrier</dt>
          <dd>{shipment.carrier}</dd>
          <dt>Status</dt>
          <dd>{shipment.status}</dd>
        </dl>
        <p>
          <Link to={`/documents/${shipment.document_id}`}>Open the bill of lading</Link>
        </p>
        <button type="button" onClick={() => post(`/api/shipments/${shipment.id}/notes`, { note: "checked" }).then(() => setSaid("Saved."), (e: Error) => setSaid(e.message))}>
          Add a note
        </button>
        {said && <p className="muted">{said}</p>}
      </div>
    </div>
  );
}
