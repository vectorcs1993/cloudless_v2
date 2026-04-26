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
    type: 'fitting',
    label: 'Фитинг',
    color: '#ff9800',
    width: 64,
    height: 64,
    svg: `<svg width="64" height="64" viewBox="0 0 64 64">
    <circle cx="32" cy="32" r="14" fill="none" stroke="#ff9800" stroke-width="4"/>
    <text x="32" y="37" text-anchor="middle" fill="#ff9800" font-size="14" font-weight="bold">F</text>
  </svg>`
  }
]);
