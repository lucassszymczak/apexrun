// Preview APENAS em desenvolvimento (import.meta.env.DEV), acessível em
// http://localhost:5173/#preview. Renderiza o dashboard com dados de exemplo,
// sem auth/Supabase — serve para checar os gráficos visualmente. Não entra no
// build de produção (guardado por DEV no App).

import { DashboardView } from './Dashboard';
import type { DashActivity, DashSplit, ZoneTime } from './transform';

function a(
  id: string,
  data: string,
  tipo: string,
  dist: number,
  pace: number,
  fc: number,
  fcx: number,
  rpe: number,
): DashActivity {
  return {
    id, data, tipo, distancia_m: dist, duracao_s: Math.round((pace * dist) / 1000),
    pace_medio: pace, fc_media: fc, fc_max: fcx, rpe, dor_flag: false,
    quality_status: 'ok', confirmed_at: data, source: 'manual',
  };
}

const activities: DashActivity[] = [
  a('l1', '2026-08-02', 'longao', 9160, 438, 163, 185, 5),
  a('r1', '2026-08-06', 'rodagem', 7010, 459, 165, 177, 4),
  a('q1', '2026-08-04', 'qualidade', 5050, 477, 151, 177, 7),
  a('l2', '2026-08-08', 'longao', 12010, 497, 173, 195, 7),
  a('r2', '2026-08-12', 'rodagem', 6010, 456, 165, 182, 5),
  a('l3', '2026-08-15', 'longao', 17000, 465, 166, 190, 6),
];

function splits(id: string, paces: number[], fcs: number[]): DashSplit[] {
  return paces.map((p, i) => ({
    activity_id: id, km_index: i + 1, distancia_m: 1000, parcial: false,
    pace_s_por_km: p, fc_media: fcs[i], fc_max: fcs[i] + 8, gap_s_por_km: p - 6,
  }));
}

const splitsByActivity = new Map<string, DashSplit[]>([
  ['l1', splits('l1', [470, 460, 450, 445, 440, 435], [150, 158, 162, 166, 168, 171])],
  ['l2', splits('l2', [520, 510, 500, 495, 490, 485, 480], [160, 168, 172, 176, 180, 184, 186])],
  ['l3', splits('l3', [480, 470, 465, 460, 455, 450, 445, 440], [156, 162, 166, 168, 170, 172, 173, 174])],
  ['q1', splits('q1', [500, 360, 480, 350, 470], [150, 176, 158, 177, 160])],
]);

const zoneTimes: ZoneTime[] = [
  { zona: 1, nome: 'Z1', fc_min: 119, fc_max: 139, segundos: 320 },
  { zona: 2, nome: 'Z2', fc_min: 139, fc_max: 158, segundos: 1650 },
  { zona: 3, nome: 'Z3', fc_min: 158, fc_max: 172, segundos: 2100 },
  { zona: 4, nome: 'Z4', fc_min: 172, fc_max: 182, segundos: 640 },
  { zona: 5, nome: 'Z5', fc_min: 182, fc_max: 198, segundos: 90 },
];

export function PreviewDashboard() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <h1 className="text-xl font-semibold">Apex Performance — preview</h1>
          <p className="text-sm text-slate-500">Dados de exemplo (dev)</p>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <DashboardView
          activities={activities}
          splitsByActivity={splitsByActivity}
          zoneTimes={zoneTimes}
        />
      </main>
    </div>
  );
}
