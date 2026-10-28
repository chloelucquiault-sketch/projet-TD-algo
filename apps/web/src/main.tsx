import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { CampApp } from "./camp-pages";
import "./styles.css";
import "./admin.css";
import "./theme.css";
import "./camp.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <CampApp />
    </BrowserRouter>
  </React.StrictMode>,
);
