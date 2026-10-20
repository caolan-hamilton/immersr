import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "./styles.css";

const root = createRoot(document.getElementById("root")!);

// PROTOTYPE (throwaway, branch prototype/ui-busy): the busy-style UI prototype, dev only, at /?prototype.
if (import.meta.env.DEV && new URLSearchParams(location.search).has("prototype")) {
  void import("./prototype-ui/PrototypeApp.tsx").then(({ PrototypeApp }) =>
    root.render(
      <StrictMode>
        <PrototypeApp />
      </StrictMode>,
    ),
  );
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
