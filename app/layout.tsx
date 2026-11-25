import type { Metadata } from "next";
import { siteOrigin } from "../lib/config";
import "./style.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: { default: "Otter Library", template: "%s | Otter Library" },
  description: "A little library where your personal agent can reserve books with your permission.",
  openGraph: { images: [{ url: "/og.png", width: 1200, height: 630 }], type: "website" },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>
    <header className="shell nav">
      <a className="wordmark" href="/" aria-label="Otter Library home"><span aria-hidden="true">◈</span> Otter Library</a>
      <nav aria-label="Library"><a href="/#shelf">The shelf</a><a href="/my-holds">My holds</a><a href="/activity">Activity</a></nav>
    </header>
    <main className="shell">{children}</main>
    <footer className="shell footer"><span>OTTER LIBRARY · AN AUTH0 POPPY SAMPLE</span><span>Fictional books. Real consent.</span></footer>
  </body></html>;
}
