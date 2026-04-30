export interface CreateReleaseInput {
  projectId: string;
  version?: string;
  title?: string;
  description?: string;
  channel?: 'stable' | 'beta' | 'canary' | 'hotfix';
  type?: 'major' | 'minor' | 'patch' | 'prerelease' | 'hotfix';
  releaseNotes?: string;
  changelogs?: CreateChangelogInput[];
  tags?: string[];
  createdBy?: string;
}

export interface CreateChangelogInput {
  category: 'added' | 'changed' | 'fixed' | 'deprecated' | 'removed' | 'security' | 'performance' | 'docs' | 'refactor' | 'test' | 'chore';
  title: string;
  description?: string;
  impact?: 'major' | 'minor' | 'patch';
  metadata?: Record<string, unknown>;
}

export interface UpdateReleaseInput {
  title?: string;
  description?: string;
  status?: 'draft' | 'review' | 'approved' | 'published' | 'archived' | 'rolled_back';
  channel?: 'stable' | 'beta' | 'canary' | 'hotfix';
  releaseNotes?: string;
  metadata?: Record<string, unknown>;
}

export interface AddChangelogInput {
  category: string;
  title: string;
  description?: string;
  impact?: string;
  metadata?: Record<string, unknown>;
}

export interface ReleaseApprovalInput {
  approverId?: string;
  role?: string;
  decision: 'approved' | 'rejected' | 'skipped';
  comment?: string;
}

export interface ReleaseMilestoneInput {
  name: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'skipped';
}

export interface ReleaseFilter {
  projectId?: string;
  status?: string;
  channel?: string;
  type?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface VersionCompareResult {
  base: { version: string; releaseDate?: string };
  target: { version: string; releaseDate?: string };
  changelogs: { base: any[]; target: any[] };
  newEntries: any[];
  removedEntries: any[];
  summary: string;
}

export const CHANGELOG_CATEGORIES = [
  'added', 'changed', 'fixed', 'deprecated', 'removed',
  'security', 'performance', 'docs', 'refactor', 'test', 'chore',
] as const;

export const RELEASE_STATUSES = [
  'draft', 'review', 'approved', 'published', 'archived', 'rolled_back',
] as const;

export const RELEASE_CHANNELS = ['stable', 'beta', 'canary', 'hotfix'] as const;

export const RELEASE_TYPES = ['major', 'minor', 'patch', 'prerelease', 'hotfix'] as const;
