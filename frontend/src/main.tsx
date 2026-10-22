import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/index.css";
const root = ReactDOM.createRoot(document.getElementById("root")!);
import("./App")
  .then(({ default: App }) =>
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    ),
  )
  .catch(() =>
    root.render(
      <main className="fatal-error">
        <h1>Workspace configuration error</h1>
        <p>
          Set VITE_DATA_MODE to mock or live, then restart the development
          server.
        </p>
        <button className="button" onClick={() => location.reload()}>
          Reload workspace
        </button>
      </main>,
    ),
  );
