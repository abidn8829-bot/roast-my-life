import type { CSSProperties } from "react";

// Isolated playground: hardcoded data only. No Supabase, Serwist, or Groq.
const dummyData = {
  badge: "Senior VP of Staying Informed",
  statement:
    "You aren't just scrolling; you are archiving the collapse of the attention economy in real-time. Your brain treats the feed like an ancient library, and you are its loneliest scholar.",
  subline: "9 hours of due diligence yesterday. Zero deliverables.",
  grade: "Grade: F-",
  system: "EMBER AI",
  auditId: "EMB-0001-TEST",
  status: "FINAL",
  domain: "emberai.site",
} as const;

const INK = "#111111";
const PAPER = "#FDFDFB";

const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Courier New", monospace';
const serif = 'Georgia, "Times New Roman", Times, serif';

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0A0A0A",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    boxSizing: "border-box",
  },
  card: {
    aspectRatio: "9 / 16",
    height: "min(92vh, 960px)",
    maxWidth: "100%",
    background: PAPER,
    color: INK,
    display: "flex",
    flexDirection: "column",
    padding: "6% 7%",
    boxSizing: "border-box",
    overflow: "hidden",
  },
  metrics: {
    fontFamily: mono,
    fontSize: "clamp(9px, 1.3vh, 12px)",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    borderTop: `1px solid ${INK}`,
    borderBottom: `1px solid ${INK}`,
    padding: "10px 0",
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
  },
  badge: {
    fontFamily: mono,
    fontSize: "clamp(10px, 1.5vh, 13px)",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    border: `1px solid ${INK}`,
    padding: "6px 12px",
    alignSelf: "flex-start",
    marginTop: "6%",
  },
  body: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: "4%",
  },
  statement: {
    fontFamily: serif,
    fontSize: "clamp(18px, 3vh, 30px)",
    lineHeight: 1.35,
    margin: 0,
    fontWeight: 400,
  },
  subline: {
    fontFamily: mono,
    fontSize: "clamp(10px, 1.5vh, 13px)",
    lineHeight: 1.5,
    margin: 0,
  },
  stampWrap: {
    display: "flex",
    justifyContent: "center",
    padding: "4% 0",
  },
  stamp: {
    fontFamily: serif,
    fontWeight: 700,
    fontSize: "clamp(28px, 5.5vh, 56px)",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    border: `4px double ${INK}`,
    padding: "14px 28px",
    transform: "rotate(-4deg)",
  },
  footer: {
    fontFamily: mono,
    fontSize: "clamp(10px, 1.5vh, 13px)",
    letterSpacing: "0.14em",
    textAlign: "center",
    borderTop: `1px solid ${INK}`,
    paddingTop: 12,
  },
};

export default function ShareTestPage() {
  return (
    <main style={styles.page}>
      <article style={styles.card}>
        <div style={styles.metrics}>
          <span>System: {dummyData.system}</span>
          <span>Audit ID: {dummyData.auditId}</span>
          <span>Status: {dummyData.status}</span>
        </div>

        <div style={styles.badge}>{dummyData.badge}</div>

        <div style={styles.body}>
          <p style={styles.statement}>{dummyData.statement}</p>
          <p style={styles.subline}>{dummyData.subline}</p>
        </div>

        <div style={styles.stampWrap}>
          <div style={styles.stamp}>{dummyData.grade}</div>
        </div>

        <footer style={styles.footer}>{dummyData.domain}</footer>
      </article>
    </main>
  );
}
