// TOUR DE BOAS-VINDAS (app para outras pessoas, 22/11/2026; docs/app-para-outros.md).
// Aparece só no primeiro acesso de um aparelho sem dados. 5 passos curtos, "Pular" em todos:
// 1 boas-vindas · 2 você (nome, cidade e estado, FC) · 3 como o app funciona · 4 primeiro treino
// (exportar o .FIT do Garmin Connect) · 5 pronto. Nada é inventado: o que ficar em branco
// mostra "—" nos números que dependem dele.
import { useState } from 'react';
import { IconHome, IconRoute, IconTrendingUp, IconFileImport, IconLock, IconCheck } from '@tabler/icons-react';
import { getState, commit } from '../store';
import { href, go } from '../route';
import { Simbolo } from '../ui';
import { UFS, altitudeDaCidade } from '../perfil';

const N = 5;
function fim(destino: 'hoje' | 'importar' | 'config') {
  const a = getState().athlete; a.tour = 'visto'; commit();
  if (destino === 'config') go('mais', 'config'); else go(destino);
}

export function Tour() {
  const [p, setP] = useState(1);
  const a = getState().athlete;
  const [f, setF] = useState({ name: a.name || '', cidade: '', uf: '', fcRep: a.fcRep ? String(a.fcRep) : '', fcMax: a.fcMax ? String(a.fcMax) : '', age: a.age ? String(a.age) : '', weight: a.weight ? String(a.weight) : '' });
  const s = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });
  const fcErro = f.fcRep && f.fcMax && +f.fcMax <= +f.fcRep ? 'A FC máxima precisa ser maior que a de repouso.' : '';
  const salvaVoce = () => {
    const A = getState().athlete;
    const num = (x: string) => (x.trim() && isFinite(+x) && +x > 0 ? Math.round(+x * 10) / 10 : null);
    A.name = f.name.trim() || null;
    A.fcRep = num(f.fcRep); A.fcMax = num(f.fcMax); A.age = num(f.age); A.weight = num(f.weight);
    if (f.cidade.trim() && f.uf) {
      A.city = f.cidade.trim() + '/' + f.uf;
      // altitude da cidade para o ajuste de clima; sem resposta, o ajuste não aparece
      altitudeDaCidade(f.cidade, f.uf).then((alt) => { const B = getState().athlete; if (B.city === f.cidade.trim() + '/' + f.uf) { B.baseAltM = alt; commit(); } });
    }
    commit(); setP(3);
  };
  const Passo = () => <span className="cap tn">Passo {p} de {N}</span>;
  const Pular = () => <button type="button" className="link tour-pular" onClick={() => fim('hoje')}>Pular</button>;
  return (
    <div className="tour">
      <header className="tour-top"><Passo /><Pular /></header>
      {p === 1 ? (
        <section className="tour-passo" aria-labelledby="t1">
          <Simbolo size={48} />
          <h1 className="titulo-1" id="t1">Seus treinos, lidos com calma.</h1>
          <p className="corpo">O Apex Performance lê os seus treinos de corrida e de bike e mostra o que eles dizem: ritmo, frequência cardíaca, carga e evolução.</p>
          <p className="apoio tour-nota"><IconLock size={18} stroke={1.75} aria-hidden="true" />Tudo fica só neste aparelho. Sem conta, sem senha, e ninguém mais vê.</p>
          <button type="button" className="btn-primary" onClick={() => setP(2)}>Começar</button>
          <a className="link tour-dono" href={href('mais', 'config')} onClick={() => { getState().athlete.tour = 'visto'; commit(); }}>Já uso o app: conectar meu código</a>
        </section>
      ) : p === 2 ? (
        <section className="tour-passo" aria-labelledby="t2">
          <h1 className="titulo-1" id="t2">Sobre você</h1>
          <p className="apoio">Só o que os cálculos precisam. Tudo é opcional, e você muda depois em Mais › Configurações.</p>
          <div className="field"><label htmlFor="t_nome">Seu nome</label><input id="t_nome" autoComplete="given-name" value={f.name} onChange={s('name')} /></div>
          <div className="tour-2col">
            <div className="field"><label htmlFor="t_cid">Cidade</label><input id="t_cid" autoComplete="address-level2" value={f.cidade} onChange={s('cidade')} /></div>
            <div className="field"><label htmlFor="t_uf">Estado</label><select id="t_uf" value={f.uf} onChange={s('uf')}><option value="">—</option>{UFS.map((u) => <option key={u} value={u}>{u}</option>)}</select></div>
          </div>
          <p className="hint">A cidade dá a altitude, usada para comparar o clima do treino com o da sua cidade.</p>
          <div className="tour-2col">
            <div className="field"><label htmlFor="t_rep">FC de repouso <span className="faint">· bpm</span></label><input id="t_rep" type="number" inputMode="numeric" value={f.fcRep} onChange={s('fcRep')} /></div>
            <div className="field"><label htmlFor="t_max">FC máxima <span className="faint">· bpm</span></label><input id="t_max" type="number" inputMode="numeric" value={f.fcMax} onChange={s('fcMax')} aria-describedby="t_fcerro" /></div>
          </div>
          <p className="hint">As duas aparecem no relógio (Garmin Connect › Desempenho › Zonas de frequência cardíaca). Sem elas, carga e zonas de FC mostram "—".</p>
          {fcErro ? <p className="apoio" id="t_fcerro" style={{ color: 'var(--alerta)' }}>{fcErro}</p> : null}
          <div className="tour-2col">
            <div className="field"><label htmlFor="t_ida">Idade</label><input id="t_ida" type="number" inputMode="numeric" value={f.age} onChange={s('age')} /></div>
            <div className="field"><label htmlFor="t_pes">Peso <span className="faint">· kg</span></label><input id="t_pes" type="number" inputMode="decimal" value={f.weight} onChange={s('weight')} /></div>
          </div>
          <button type="button" className="btn-primary" disabled={!!fcErro} onClick={salvaVoce}>Continuar</button>
        </section>
      ) : p === 3 ? (
        <section className="tour-passo" aria-labelledby="t3">
          <h1 className="titulo-1" id="t3">Como o app funciona</h1>
          <ul className="tour-lista">
            <li><IconHome size={24} stroke={1.75} aria-hidden="true" /><span><b>Hoje</b> · como você está para treinar e o resumo do último treino.</span></li>
            <li><IconRoute size={24} stroke={1.75} aria-hidden="true" /><span><b>Treinos</b> · cada treino com o mapa, o ritmo e a frequência cardíaca, km a km.</span></li>
            <li><IconTrendingUp size={24} stroke={1.75} aria-hidden="true" /><span><b>Progresso</b> · a evolução ao longo das semanas.</span></li>
          </ul>
          <p className="apoio">Toque em qualquer número para ver o que ele significa.</p>
          <button type="button" className="btn-primary" onClick={() => setP(4)}>Continuar</button>
        </section>
      ) : p === 4 ? (
        <section className="tour-passo" aria-labelledby="t4">
          <h1 className="titulo-1" id="t4">Seu primeiro treino</h1>
          <p className="apoio">O app lê o arquivo .FIT que o relógio grava. No Garmin:</p>
          <ol className="tour-passos">
            <li>Abra <b>connect.garmin.com</b> no navegador e entre na sua conta.</li>
            <li>Em <b>Atividades</b>, abra o treino.</li>
            <li>Toque na engrenagem e escolha <b>Exportar original</b>. Vem um arquivo .zip.</li>
            <li>No iPhone, toque no .zip no app Arquivos para abrir: dentro está o .FIT.</li>
            <li>Volte aqui e toque em <b>Importar .FIT</b>.</li>
          </ol>
          <button type="button" className="btn-primary" onClick={() => setP(5)}>Continuar</button>
        </section>
      ) : (
        <section className="tour-passo" aria-labelledby="t5">
          <span className="tour-ok" aria-hidden="true"><IconCheck size={28} stroke={2} /></span>
          <h1 className="titulo-1" id="t5">Tudo pronto.</h1>
          <p className="corpo">Depois do primeiro treino, o Hoje e o Progresso começam a mostrar números. Quanto mais treinos, mais o app entende o seu ritmo.</p>
          <button type="button" className="btn-primary" onClick={() => fim('importar')}><IconFileImport size={20} stroke={1.75} aria-hidden="true" />Importar .FIT</button>
          <button type="button" className="btn quiet" onClick={() => fim('hoje')}>Ir para o Hoje</button>
        </section>
      )}
      <div className="tour-dots" aria-hidden="true">{Array.from({ length: N }, (_, i) => <i key={i} className={i + 1 === p ? 'on' : ''} />)}</div>
    </div>
  );
}
