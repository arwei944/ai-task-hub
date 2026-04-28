import type { IntegrationAdapter, SyncOptions, SyncResult, PushResult } from '../integration-core/types';
import type { ILogger } from '@/lib/core/types';

export class GitHubAdapter implements IntegrationAdapter {
  readonly type = 'github';
  readonly name = 'GitHub';

  constructor(private logger: ILogger) {}

  async pullTasks(options?: SyncOptions): Promise<SyncResult> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return { success: false, synced: 0, created: 0, updated: 0, errors: ['GITHUB_TOKEN not configured'] };
    }

    const repo = process.env.GITHUB_REPO;
    if (!repo) {
      return { success: false, synced: 0, created: 0, updated: 0, errors: ['GITHUB_REPO not configured'] };
    }

    try {
      const url = `https://api.github.com/repos/${repo}/issues?state=open&per_page=${options?.limit ?? 100}`;
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'AI-Task-Hub',
      };

      if (options?.since) {
        headers['If-Modified-Since'] = options.since.toUTCString();
      }

      const response = await fetch(url, { headers });
      if (!response.ok) {
        const error = await response.text();
        return { success: false, synced: 0, created: 0, updated: 0, errors: [`GitHub API error: ${response.status} - ${error}`] };
      }

      const issues: any[] = await response.json();
      // Filter out pull requests (they appear as issues in the API)
      const tasks = issues.filter((i: any) => !i.pull_request);

      this.logger.info(`GitHub: fetched ${tasks.length} issues from ${repo}`);

      return {
        success: true,
        synced: tasks.length,
        created: tasks.length,
        updated: 0,
        errors: [],
      };
    } catch (error: any) {
      return { success: false, synced: 0, created: 0, updated: 0, errors: [error.message] };
    }
  }

  async pushTask(task: { title: string; description?: string; status?: string; priority?: string; externalId?: string }): Promise<PushResult> {
    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPO;
    if (!token || !repo) {
      return { success: false, error: 'GitHub not configured' };
    }

    try {
      const body: any = {
        title: task.title,
        body: task.description ?? '',
        state: task.status === 'done' || task.status === 'closed' ? 'closed' : 'open',
      };

      // Map priority to labels
      if (task.priority) {
        body.labels = [task.priority];
      }

      let url: string;
      if (task.externalId) {
        // Update existing issue
        url = `https://api.github.com/repos/${repo}/issues/${task.externalId}`;
        const response = await fetch(url, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'AI-Task-Hub',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          const error = await response.text();
          return { success: false, error: `GitHub API error: ${error}` };
        }
        const issue = await response.json();
        return { success: true, externalId: String(issue.number), externalUrl: issue.html_url };
      } else {
        // Create new issue
        url = `https://api.github.com/repos/${repo}/issues`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'AI-Task-Hub',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          const error = await response.text();
          return { success: false, error: `GitHub API error: ${error}` };
        }
        const issue = await response.json();
        return { success: true, externalId: String(issue.number), externalUrl: issue.html_url };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async handleWebhook(payload: unknown, headers?: Record<string, string>): Promise<void> {
    const event = headers?.['x-github-event'];
    const data = payload as any;

    this.logger.info(`GitHub webhook received: ${event}`);

    switch (event) {
      case 'issues':
        if (data.action === 'opened' || data.action === 'edited') {
          this.logger.info(`GitHub issue ${data.action}: #${data.issue?.number} - ${data.issue?.title}`);
        } else if (data.action === 'closed') {
          this.logger.info(`GitHub issue closed: #${data.issue?.number}`);
        }
        break;
      case 'push':
        this.logger.info(`GitHub push: ${data.ref} by ${data.sender?.login}`);
        break;
      case 'pull_request':
        this.logger.info(`GitHub PR ${data.action}: #${data.pull_request?.number}`);
        break;
      default:
        this.logger.debug(`GitHub webhook unhandled event: ${event}`);
    }
  }

  async testConnection(config: Record<string, string>): Promise<{ success: boolean; error?: string }> {
    try {
      const token = config.token || process.env.GITHUB_TOKEN;
      if (!token) return { success: false, error: 'No GitHub token provided' };

      const repo = config.repo || process.env.GITHUB_REPO;
      if (!repo) return { success: false, error: 'No GitHub repo configured' };

      const response = await fetch(`https://api.github.com/repos/${repo}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'AI-Task-Hub',
        },
      });

      if (!response.ok) {
        return { success: false, error: `GitHub API returned ${response.status}` };
      }

      const repoData = await response.json();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
