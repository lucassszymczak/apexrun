// IMPORTAR (botão "+"). Etapa 1: escolher o .FIT (ou arrastar, no computador) →
// conferir e completar → salvar e abrir o Treino. Mesmo leitor e mesmas regras do
// app antigo. Vários arquivos de uma vez e fotos chegam nas Etapas 2 e 3.
import { useRef, useState } from 'react';
import { IconFileUpload, IconPencil, IconLoader2 } from '@tabler/icons-react';
import { PageHead } from '../Shell';
import { Card, CardH, IC } from '../ui';
import { readFitFile } from '../actions';
import { TreinoForm } from './TreinoForm';
import { href } from '../route';

export function Importar() {
  const [prefill, setPrefill] = useState<any>(null);
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const read = async (file: File | undefined | null) => {
    if (!file) return;
    setErr(null); setBusy('Lendo ' + file.name + '…');
    try {
      const w = await readFitFile(file);
      setPrefill(w);
    } catch (e: any) {
      console.error(e);
      setErr('Não foi possível ler o .FIT. ' + (e && e.message ? e.message : String(e)) + ' Você ainda pode registrar à mão.');
    } finally { setBusy(null); }
  };

  if (prefill) return <TreinoForm prefill={prefill} fromFit step="Passo 2 de 2 · conferir e completar" onCancel={() => setPrefill(null)} />;
  if (manual) return <TreinoForm step="Registro à mão" onCancel={() => setManual(false)} />;

  return (<>
    <PageHead title="Importar treino" sub="Passo 1 de 2 · arquivo" back={href('hoje')} right={null} />
    <Card
      onDragOver={(e: any) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e: any) => { e.preventDefault(); setDrag(false); read(e.dataTransfer.files && e.dataTransfer.files[0]); }}
      style={{ border: '1px dashed ' + (drag ? 'var(--ciano)' : 'var(--linha)'), alignItems: 'center', textAlign: 'center', padding: '32px 16px' }}>
      <IconFileUpload size={36} stroke={1.5} color="var(--ciano)" aria-hidden="true" />
      <h2 className="lead">Escolha o arquivo .FIT do relógio</h2>
      <p className="apoio muted">Distância, FC, cadência, elevação, splits por km e a análise por amostra entram sozinhos.<span className="only-desk"> Você também pode arrastar o arquivo para cá.</span></p>
      <input ref={input} type="file" accept=".fit,.FIT,application/octet-stream" className="sr-only" id="fitFile" onChange={(e) => { read(e.target.files && e.target.files[0]); e.target.value = ''; }} />
      <button type="button" className="btn-primary" onClick={() => input.current?.click()} disabled={!!busy}>
        {busy ? <IconLoader2 {...IC} aria-hidden="true" /> : <IconFileUpload {...IC} aria-hidden="true" />}{busy ? 'Lendo…' : 'Escolher .FIT'}
      </button>
      <div role="status" aria-live="polite" className="apoio muted">{busy || ''}</div>
      {err ? <p className="apoio" style={{ color: 'var(--alerta)' }} role="alert">{err}</p> : null}
    </Card>
    <Card>
      <CardH icon={<IconPencil {...IC} />} title="Sem arquivo?" />
      <p className="apoio muted">Registre o treino à mão: distância, tempo, FC e, se tiver, os splits por km.</p>
      <button type="button" className="btn quiet" onClick={() => setManual(true)} style={{ alignSelf: 'flex-start' }}>Registrar à mão</button>
    </Card>
  </>);
}
