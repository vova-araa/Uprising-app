import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#0f0f14",
            color: "#f5f5f5",
            padding: "2rem",
            fontFamily: "'DM Sans', system-ui, sans-serif",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>
            Er ging iets mis
          </h1>
          <p style={{ color: "#888", fontSize: "0.875rem", maxWidth: 400, marginBottom: "1.5rem" }}>
            De app kon niet worden geladen. Probeer de app opnieuw te openen.
          </p>
          <pre
            style={{
              background: "#1a1a22",
              padding: "1rem",
              borderRadius: 8,
              fontSize: "0.75rem",
              color: "#ff4444",
              maxWidth: "90vw",
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              marginBottom: "1.5rem",
            }}
          >
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.hash = "#/";
              window.location.reload();
            }}
            style={{
              background: "#7c3aed",
              color: "#fff",
              border: "none",
              padding: "0.75rem 2rem",
              borderRadius: 8,
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Opnieuw laden
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
