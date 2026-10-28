export function Bean({ color, name, size = "md", crown = false }: { color: string; name?: string; size?: "sm" | "md" | "lg"; crown?: boolean }) {
  return <div className={`bean-wrap bean-${size}${crown ? " has-crown" : ""}`}>
    {crown && <span className="bean-crown">♛</span>}
    {name && <span className="bean-name">{name}</span>}
    <div className="bean-body" style={{ "--bean": color } as React.CSSProperties}>
      <span className="bean-face"><i/><i/></span><span className="bean-arm left"/><span className="bean-arm right"/><span className="bean-foot left"/><span className="bean-foot right"/>
    </div>
  </div>;
}
