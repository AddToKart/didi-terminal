import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { Dashboard } from "./dashboard/Dashboard";
import "./index.css";

const isDashboard = window.location.pathname === "/dashboard";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isDashboard ? <Dashboard /> : <App />}
  </React.StrictMode>,
);
