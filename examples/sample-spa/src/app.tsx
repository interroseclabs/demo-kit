import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet, type RouteObject } from "react-router";

import { me } from "./api";
import { Document } from "./pages/document";
import { OverviewPage } from "./pages/overview";
import { Reports } from "./pages/reports";
import { Shipments } from "./pages/shipments";
import "./app.css";

function Shell() {
  const [who, setWho] = useState<string>("");
  useEffect(() => {
    me().then((m) => setWho(m.name), () => setWho(""));
  }, []);
  return (
    <div className="shell">
      <header className="top">
        <Link to="/overview" className="brand">
          Harbor
        </Link>
        <nav aria-label="Main">
          <NavLink to="/overview">Overview</NavLink>
          <NavLink to="/shipments">Shipments</NavLink>
          <NavLink to="/reports">Reports</NavLink>
        </nav>
        <span className="who">{who}</span>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="status">Harbor · connected · v1.4</footer>
    </div>
  );
}

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <Shell />,
    children: [
      { index: true, element: <Navigate to="/overview" replace /> },
      { path: "overview", element: <OverviewPage /> },
      { path: "shipments", element: <Shipments /> },
      { path: "documents/:id", element: <Document /> },
      { path: "reports", element: <Reports /> },
    ],
  },
];
