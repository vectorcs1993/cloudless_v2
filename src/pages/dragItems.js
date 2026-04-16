export const dragItems = Object.freeze([
  {
    type: 'duct',
    label: 'Воздуховод',
    color: '#4a90e2',
    width: 64,
    height: 40,
    svg: `<svg width="64" height="64" viewBox="0 0 64 64">
      <line x1="12" y1="32" x2="52" y2="32" stroke="#4a90e2" stroke-width="4" stroke-linecap="round"/>
    </svg>`
  },
  {
    type: 'elbow',
    label: 'Отвод',
    color: '#e74c3c',
    width: 64,
    height: 64,
    svg: `<svg width="64" height="64" viewBox="0 0 64 64">
      <polyline points="12,32 32,32 32,52" fill="none" stroke="#e74c3c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
  },
  {
    type: 'transition',
    label: 'Переход',
    color: '#e67e22',
    width: 64,
    height: 64,
    svg: `<svg width="64" height="64" viewBox="0 0 64 64">
      <polygon points="12,24 52,20 52,44 12,40" fill="none" stroke="#e67e22" stroke-width="3" stroke-linejoin="round"/>
      <line x1="12" y1="32" x2="52" y2="32" stroke="#e67e22" stroke-width="1.5" stroke-dasharray="3 3"/>
    </svg>`
  },
  {
    type: 'tee',
    label: 'Тройник',
    color: '#27ae60',
    width: 64,
    height: 64,
    svg: `<svg width="64" height="64" viewBox="0 0 64 64">
      <line x1="12" y1="32" x2="52" y2="32" stroke="#27ae60" stroke-width="4" stroke-linecap="round"/>
      <line x1="32" y1="12" x2="32" y2="32" stroke="#27ae60" stroke-width="4" stroke-linecap="round"/>
    </svg>`
  },
  {
    type: 'cross',
    label: 'Крестовина',
    color: '#9b59b6',
    width: 64,
    height: 64,
    svg: `<svg width="64" height="64" viewBox="0 0 64 64">
      <line x1="12" y1="32" x2="52" y2="32" stroke="#9b59b6" stroke-width="4" stroke-linecap="round"/>
      <line x1="32" y1="12" x2="32" y2="52" stroke="#9b59b6" stroke-width="4" stroke-linecap="round"/>
    </svg>`
  },
]);
