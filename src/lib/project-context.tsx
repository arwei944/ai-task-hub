'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface ProjectContextType {
  currentProjectId: string | null;
  currentProjectName: string | null;
  setCurrentProject: (id: string, name: string) => void;
  clearProject: () => void;
  isProjectContext: boolean;
}

const ProjectContext = createContext<ProjectContextType>({
  currentProjectId: null,
  currentProjectName: null,
  setCurrentProject: () => {},
  clearProject: () => {},
  isProjectContext: false,
});

export function ProjectProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Derive project context from URL: /project-hub/[id]/...
  const match = pathname.match(/^\/project-hub\/([^/]+)/);
  const currentProjectId = match ? match[1] : null;

  // We don't store name in context since it's derived from URL
  // The name will be fetched by the page component
  const [currentProjectName, setCurrentProjectName] = useState<string | null>(null);

  const setCurrentProject = useCallback((id: string, name: string) => {
    setCurrentProjectName(name);
    router.push(`/project-hub/${id}`);
  }, [router]);

  const clearProject = useCallback(() => {
    setCurrentProjectName(null);
    router.push('/project-hub');
  }, [router]);

  const isProjectContext = !!currentProjectId;

  return (
    <ProjectContext.Provider value={{
      currentProjectId,
      currentProjectName,
      setCurrentProject,
      clearProject,
      isProjectContext,
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjectContext() {
  return useContext(ProjectContext);
}
