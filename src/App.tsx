// Shell mínimo do app. As telas reais (upload/conferência, diário, dashboards)
// chegam nos passos 2–5 do plano de construção.
export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-2xl font-semibold">Apex Performance</h1>
        <p className="text-slate-400">
          Setup do projeto concluído. Próximos passos: upload/parsing de
          .FIT/.TCX/.GPX, camada de conferência e dashboards.
        </p>
      </div>
    </div>
  );
}
