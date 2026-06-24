import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { isChromeExtension, logExtensionRedirectUrl } from "./lib/authRedirect";
import "./status-window.css";

const surface = isChromeExtension() ? "popup" : "preview";
document.documentElement.dataset.surface = surface;
document.body.dataset.surface = surface;

logExtensionRedirectUrl();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
