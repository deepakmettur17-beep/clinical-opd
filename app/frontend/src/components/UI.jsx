export const Card = ({ children, title }) => (
  <div className="card">
    {title && <h2 className="card-title">{title}</h2>}
    {children}
  </div>
);

export const Button = ({ children, variant = 'primary', size = 'normal', onClick, disabled }) => {
  const baseClass = "btn";
  const variantClass = variant === 'danger' ? 'btn-danger' : 'btn-primary';
  const sizeClass = size === 'large' ? 'btn-large' : '';
  
  return (
    <button 
      className={`${baseClass} ${variantClass} ${sizeClass}`}
      onClick={onClick}
      disabled={disabled}
      style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      {children}
    </button>
  );
};

export const Selector = ({ options, selected, onChange }) => (
  <div className="selector-grid">
    {options.map((opt) => (
      <button
        key={opt.value}
        className={`selector-btn ${selected.includes(opt.value) ? 'selected' : ''}`}
        onClick={() => onChange(opt.value)}
      >
        {opt.label}
      </button>
    ))}
  </div>
);
