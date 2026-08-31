export function Card({ children, className = "", ...rest }) {
  return (
    <div className={`card ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardHead({ title, right = null }) {
  return (
    <div className="card-head">
      <span className="card-title">{title}</span>
      {right}
    </div>
  );
}
