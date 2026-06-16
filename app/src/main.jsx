import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { ErroFronteira } from "./shared/ui/ErroFronteira.jsx";
import { instalarCapturaGlobal } from "./shared/lib/observabilidade.js";

instalarCapturaGlobal();

createRoot(document.getElementById("root")).render(
  <ErroFronteira>
    <App />
  </ErroFronteira>,
);
