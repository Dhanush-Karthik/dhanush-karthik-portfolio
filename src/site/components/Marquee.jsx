export default function Marquee({ items, className = "" }) {
  const row = items.flatMap((t, i) => [<span key={`t${i}`}>{t}</span>, <span key={`s${i}`} className="star">✦</span>]);
  return (
    <div className={`marquee ${className}`} aria-hidden="true">
      <div className="marquee-track">{row}{row.map((el, i) => <span key={`d${i}`} className={el.props.className}>{el.props.children}</span>)}</div>
    </div>
  );
}
