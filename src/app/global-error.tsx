"use client";

/** Poslední záchranná síť – nahrazuje i kořenový layout, proto bez závislostí. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="cs">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#F7F9FC", color: "#14213D", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 24 }}>WeilHub je dočasně nedostupný</h1>
          <p style={{ color: "#5f6878" }}>Zkuste prosím stránku načíst znovu za chvíli.</p>
          <button
            onClick={reset}
            style={{ marginTop: 16, background: "#2F68FF", color: "#fff", border: 0, borderRadius: 999, padding: "12px 24px", fontSize: 16, cursor: "pointer" }}
          >
            Zkusit znovu
          </button>
        </div>
      </body>
    </html>
  );
}
