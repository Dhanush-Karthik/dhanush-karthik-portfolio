import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import Sheet from "../components/Sheet";

export default function NotFound() {
  return (
    <>
      <Helmet><title>404 — Dhanush Karthik</title><meta name="robots" content="noindex" /></Helmet>
      <main>
        <Sheet id="not-found" variant="term" torn={false} trace="Exception in thread &quot;main&quot; java.io.FileNotFoundException" cmd="cd ~/somewhere">
          <h1 className="display" style={{ fontSize: "clamp(3rem, 12vw, 9rem)", color: "#fff", margin: "0 0 24px" }}>404</h1>
          <p className="lead">That path isn't in the stack. <Link to="/" style={{ color: "var(--phosphor)" }}>cd ~</Link> to go back home.</p>
        </Sheet>
      </main>
    </>
  );
}
