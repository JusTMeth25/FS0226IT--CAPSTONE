export default function EmptyState({ icon = 'ph-microphone-stage', title, description, action }) {
  return (
    <div className="empty-state glass-panel text-center">
      <div className="empty-state-icon"><i className={`ph-fill ${icon}`} /></div>
      {title && <div className="empty-state-title">{title}</div>}
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
