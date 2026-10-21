// Harbor's API client: relative URLs, so the dev server's proxy answers them.
export type Shipment = {
  id: string;
  from: string;
  to: string;
  carrier: string;
  status: "in transit" | "delayed" | "delivered";
  containers: number;
  delay_days: number;
  document_id: string;
};
export type Overview = {
  company: string;
  figures: { shipments: number; in_transit: number; delayed: number; delivered: number; on_time: number };
  delays_by_port: { port: string; delayed: number }[];
  recent: Shipment[];
};
export type Doc = { id: string; shipment: string; title: string; lines: string[] };
export type Report = { id: string; name: string; pages: number };

export async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `${res.status}`);
  return (await res.json()) as T;
}

export async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const out = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(out.error ?? `${res.status}`);
  return out;
}

// me is read with XMLHttpRequest, as an older client would.
export function me(): Promise<{ email: string; name: string }> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("GET", "/api/me");
    x.responseType = "json";
    x.onload = () => (x.status === 200 ? resolve(x.response) : reject(new Error(String(x.status))));
    x.onerror = () => reject(new Error("no answer"));
    x.send();
  });
}
