export const dragItems = Object.freeze([
  {
    type: 'duct',
    label: 'Воздуховод',
    color: '#4a90e2',
    width: 64,
    height: 40,
    svg: `<svg width="64" height="64" viewBox="0 0 64 64">
      <rect x="12" y="24" width="40" height="16" fill="#4a90e2" stroke="#2c3e50" stroke-width="2" rx="2"/>
      <line x1="12" y1="32" x2="52" y2="32" stroke="#ffffff" stroke-width="1" stroke-dasharray="4 4"/>
    </svg>`
  },
  {
    type: 'elbow',
    label: 'Отвод',
    color: '#e74c3c',
    width: 64,
    height: 64,
    svg: `<svg width="64" height="64" viewBox="0 0 64 64">
      <path d="M12 32 L32 32 L32 52" fill="none" stroke="#e74c3c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="12" cy="32" r="3" fill="#e74c3c"/>
      <circle cx="32" cy="32" r="3" fill="#e74c3c"/>
      <circle cx="32" cy="52" r="3" fill="#e74c3c"/>
    </svg>`
  },
  {
    type: 'transition',
    label: 'Переход',
    color: '#e67e22',
    width: 64,
    height: 64,
    svg: `<svg width="64" height="64" viewBox="0 0 64 64">
      <polygon points="12,24 52,20 52,44 12,40" fill="#e67e22" stroke="#2c3e50" stroke-width="2"/>
      <line x1="12" y1="32" x2="52" y2="32" stroke="#ffffff" stroke-width="1" stroke-dasharray="4 4"/>
      <text x="32" y="54" font-size="8" text-anchor="middle" fill="#fff">${'⌀'}125→200</text>
    </svg>`
  },
  {
    type: 'tee',
    label: 'Тройник',
    color: '#27ae60',
    width: 64,
    height: 64,
    svg: `<svg width="64" height="64" viewBox="0 0 64 64">
      <rect x="12" y="24" width="40" height="16" fill="#27ae60" stroke="#2c3e50" stroke-width="2" rx="2"/>
      <rect x="28" y="12" width="8" height="40" fill="#27ae60" stroke="#2c3e50" stroke-width="2" rx="2"/>
    </svg>`
  },
  {
    type: 'cross',
    label: 'Крестовина',
    color: '#9b59b6',
    width: 64,
    height: 64,
    svg: `<svg width="64" height="64" viewBox="0 0 64 64">
      <rect x="12" y="28" width="40" height="8" fill="#9b59b6" stroke="#2c3e50" stroke-width="2"/>
      <rect x="28" y="12" width="8" height="40" fill="#9b59b6" stroke="#2c3e50" stroke-width="2"/>
    </svg>`
  },
]);
