import { Link } from "react-router-dom";

export default function Footer({ data }) {
  const year = new Date().getFullYear();
  return (
    <footer className="site-foot">
      <div className="wrap">
        <div>
          <div className="exit">Process finished with exit code 0</div>
          <div suppressHydrationWarning>© {year} Dhanush Karthik · Java Backend Engineer · dhanushkarthik.com</div>
        </div>
        <nav aria-label="Elsewhere">
          <ul>
            {data.socialLinks.map((s) => <li key={s.id}><a href={s.url} rel="me noopener" target={s.url.startsWith("mailto:") ? undefined : "_blank"}>{s.platform}</a></li>)}
            {data.subdomains.map((d) => <li key={d.host}><a href={`https://${d.host}`} target="_blank" rel="noopener">{d.host}</a></li>)}
            <li><Link to="/">home</Link></li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
