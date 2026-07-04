/** Bordo con bagliore animato che orbita il contenuto, per evidenziare una call-to-action premium. */
export default function StarBorder({ as: Tag = 'div', className = '', color = '#fff', speed = '4s', children, ...rest }) {
  return (
    <Tag className={`star-border ${className}`} {...rest}>
      <span
        className="star-border-glow star-border-glow-bottom"
        style={{ background: `radial-gradient(circle, ${color}, transparent 10%)`, animationDuration: speed }}
      />
      <span
        className="star-border-glow star-border-glow-top"
        style={{ background: `radial-gradient(circle, ${color}, transparent 10%)`, animationDuration: speed }}
      />
      <span className="star-border-inner">{children}</span>
    </Tag>
  );
}
