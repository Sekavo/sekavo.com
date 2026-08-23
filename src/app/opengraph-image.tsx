import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Sekavo — Get paid without the chasing.";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f8f8f6",
          padding: "80px 90px",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
          <span style={{ fontSize: 44, fontWeight: 600, color: "#1a1d21", letterSpacing: "-0.01em" }}>
            Sekavo
          </span>
          <span style={{ width: 14, height: 14, borderRadius: 999, background: "#14684c", display: "flex" }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, fontWeight: 700, color: "#1a1d21", lineHeight: 1.08, letterSpacing: "-0.015em" }}>
            Get paid without
          </div>
          <div style={{ fontSize: 76, fontWeight: 700, color: "#1a1d21", lineHeight: 1.08, letterSpacing: "-0.015em" }}>
            the chasing.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 28, color: "#52565e" }}>
            Automated invoice follow-ups for freelancers and studios.
          </div>
          <div style={{ fontSize: 26, color: "#10533e" }}>sekavo.com</div>
        </div>
      </div>
    ),
    size
  );
}
