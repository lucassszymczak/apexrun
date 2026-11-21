// Detecção de segmentos fora da tela (Fase 3 · Etapa 4): a conta com todos os trajetos leva
// de 1 a 5 s no celular; aqui ela não trava a interface.
import { calculaSegmentos } from '../segmentos.mjs';
self.onmessage = (e: MessageEvent) => {
  const { treinos, modal, anterior } = e.data;
  try {
    const r = calculaSegmentos(treinos, modal, anterior);
    (self as any).postMessage({ ok: true, lista: r.lista, passagens: [...r.passagens.entries()] });
  } catch (err: any) { (self as any).postMessage({ ok: false, erro: String(err && err.message) }); }
};
