// Peças compartilhadas entre telas.
import { IconBike, IconRun, IconTreadmill } from '@tabler/icons-react';
import * as E from '../../engine.mjs';

// Mini-trajeto do treino. O trajeto salvo chega na Etapa 2 (IndexedDB); até lá — e
// para treinos sem GPS — mostra o ícone da modalidade, como manda o roteiro.
export function MiniRoute({ w, size = 64 }: { w: any; size?: number }) {
  const I = E.isBike(w) ? IconBike : w.indoor ? IconTreadmill : IconRun;
  return <span className="tile" style={{ width: size, height: size }} aria-hidden="true"><I size={Math.round(size * 0.42)} stroke={1.5} /></span>;
}
