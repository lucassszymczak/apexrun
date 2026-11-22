// COMPARTILHAR O APP (22/11/2026). Manda só o endereço do app (sem a parte depois do "#",
// sem código de sincronização, sem nenhum dado). No celular, abre o menu de compartilhar do
// aparelho; sem esse menu (computador), copia o link.
export const TEXTO_APP = 'Apex Performance: análise dos seus treinos de corrida e bike. Seus dados ficam só no seu aparelho, sem conta e sem senha.';

export function linkDoApp(): string {
  return location.origin + location.pathname.replace(/index\.html$/, '');
}

export async function compartilharApp(): Promise<'shared' | 'copied' | 'cancelled' | 'shown'> {
  const url = linkDoApp();
  const nav: any = navigator;
  if (nav.share) {
    try { await nav.share({ title: 'Apex Performance', text: TEXTO_APP, url }); return 'shared'; }
    catch (e: any) { if (e && e.name === 'AbortError') return 'cancelled'; }
  }
  try { await navigator.clipboard.writeText(url); return 'copied'; }
  catch { prompt('Copie o link do app:', url); return 'shown'; }
}
