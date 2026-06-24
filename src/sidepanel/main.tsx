import React from "react";
import ReactDOM from "react-dom/client";
import { SidePanelApp } from "./SidePanelApp";
import "../status-window.css";

ReactDOM.createRoot(document.getElementById("sidepanel-root")!).render(
  <React.StrictMode>
    <SidePanelApp />
  </React.StrictMode>,
);
