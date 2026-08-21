// Tokens de gráfico para o tema escuro do app (Recharts).
// O app é dark-only por decisão de design, então as cores são fixas e pintadas
// explicitamente (nada depende do tema do host).

export const CHART = {
  accent: '#34d399', // emerald-400 (destaque / série única)
  accentDeep: '#059669', // emerald-600
  grid: '#1e293b', // slate-800
  axis: '#94a3b8', // slate-400
  ink: '#e2e8f0', // slate-200
  muted: '#64748b', // slate-500
  surface: '#0b1220',
};

// Rampa sequencial (Z1 clara → Z5 escura), hue único — evita "arco-íris".
// Usada nas zonas de FC (magnitude ordinal), acessível por ser mono-hue.
export const ZONE_RAMP = ['#a7f3d0', '#6ee7b7', '#34d399', '#10b981', '#047857'];
