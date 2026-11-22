// Privacidade: o editor (Treino › escudo, Completar e Configurações › Privacidade padrão).
import { useState } from 'react';
import { IconShield, IconShieldCheck, IconShieldOff } from '@tabler/icons-react';
import { Seg, Sheet } from '../ui';
import { type Privacy, privacyLabel } from '../privacy';

export function PrivacyIcon({ p, size = 20 }: { p: Privacy; size?: number }) {
  const C = p.mapa === 'ocultar' ? IconShieldCheck : p.mapa === 'nenhum' ? IconShieldOff : IconShield;
  return <C size={size} stroke={1.75} aria-hidden="true" />;
}

export function PrivacyFields({ value, onChange }: { value: Privacy; onChange: (p: Privacy) => void }) {
  const set = (k: keyof Privacy, v: any) => onChange({ ...value, [k]: v });
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="field">
        <span className="lab" id="pv-mapa">Mapa nas imagens compartilhadas</span>
        <Seg value={value.mapa} onChange={(v) => set('mapa', v)} label="Mapa nas imagens compartilhadas" options={[['completo', 'Completo'], ['ocultar', 'Ocultar início e fim'], ['nenhum', 'Sem mapa']]} />
        <span className="help">{value.mapa === 'ocultar' ? 'Tira do desenho todo ponto perto da largada e da chegada, para não mostrar onde você mora.' : value.mapa === 'nenhum' ? 'Os cards saem só com os números.' : 'O trajeto aparece inteiro, com largada e chegada.'}</span>
      </div>
      {value.mapa === 'ocultar' ? (
        <div className="field">
          <span className="lab">Raio</span>
          <Seg value={String(value.raio) as '200' | '500' | '1000'} onChange={(v) => set('raio', +v)} label="Raio ocultado" options={[['200', '200 m'], ['500', '500 m'], ['1000', '1 km']]} />
        </div>
      ) : null}
    </div>
  );
}

export function PrivacySheet({ value, onSave, onClose, title = 'Privacidade deste treino' }: { value: Privacy; onSave: (p: Privacy) => void; onClose: () => void; title?: string }) {
  const [p, setP] = useState<Privacy>(value);
  return (
    <Sheet title={title} onClose={onClose}>
      <PrivacyFields value={p} onChange={setP} />
      <p className="apoio muted">Agora: {privacyLabel(p)}</p>
      <button type="button" className="btn" onClick={() => { onSave(p); onClose(); }}>Salvar privacidade</button>
    </Sheet>
  );
}
