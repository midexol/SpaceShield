// Landing hero stat cell (matches the prototype's .stat markup).
export function Stat({ num, lab, qual }) {
  return (
    <div className="stat">
      <div className="num">{num}</div>
      <div className="lab">{lab}</div>
      {qual ? <div className="qual">{qual}</div> : null}
    </div>
  );
}

// App metric (larger mono number + caption).
export function Metric({ value, label, sub }) {
  return (
    <div className="metric">
      <div className="big">{value}</div>
      <div className="cap">{label}</div>
      {sub ? <div className="qual">{sub}</div> : null}
    </div>
  );
}
