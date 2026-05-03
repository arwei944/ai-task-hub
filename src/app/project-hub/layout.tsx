// ============================================================
// Project Hub Layout - /project-hub
// ============================================================
//
// Minimal layout wrapper. Project-internal navigation is now
// handled by the main sidebar via ProjectContext.
// ============================================================

export default function ProjectHubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-6 max-w-[1400px] mx-auto">
        {children}
      </div>
    </main>
  );
}
