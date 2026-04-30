import { createHmac } from 'node:crypto';
import type { IntegrationAdapter, SyncOptions, SyncResult, PushResult } from '../integration-core/types';
import type { ILogger, IEventBus, DomainEvent } from '@/lib/core/types';
import type { CreateTaskDTO, TaskPriority } from '@/lib/modules/task-core/types';
import type { TaskService } from '@/lib/modules/task-core/task.service';

export interface GitHubWebhookConfig {
  /** HMAC secret for webhook signature verification. Set to empty/null to disable. */
  webhookSecret?: string;
}

export class GitHubAdapter implements IntegrationAdapter {
  readonly type = 'github';
  readonly name = 'GitHub';

  private eventBus?: IEventBus;
  private webhookSecret?: string;

  constructor(
    private logger: ILogger,
    options?: GitHubWebhookConfig,
  ) {
    this.webhookSecret = options?.webhookSecret ?? process.env.GITHUB_WEBHOOK_SECRET;
  }

  /**
   * Set the EventBus for emitting internal domain events from webhooks.
   * This is optional; if not set, webhook events are only logged.
   */
  setEventBus(eventBus: IEventBus): void {
    this.eventBus = eventBus;
  }

  async pullTasks(options?: SyncOptions, taskService?: TaskService): Promise<SyncResult> {
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

      if (!taskService) {
        return {
          success: true,
          synced: tasks.length,
          created: tasks.length,
          updated: 0,
          errors: [],
        };
      }

      // Write fetched issues to local database
      let created = 0;
      let updated = 0;
      const errors: string[] = [];

      for (const issue of tasks) {
        try {
          // Map priority from labels
          let priority: TaskPriority | undefined;
          const priorityLabels = ['urgent', 'high', 'medium', 'low'];
          for (const label of issue.labels ?? []) {
            const name = (typeof label === 'string' ? label : label.name)?.toLowerCase();
            if (priorityLabels.includes(name)) {
              priority = name as TaskPriority;
              break;
            }
          }

          const dto: CreateTaskDTO = {
            title: issue.title,
            description: issue.body ?? '',
            source: 'github',
            sourceRef: String(issue.number),
            creator: issue.user?.login,
            priority,
            metadata: {
              githubUrl: issue.html_url,
              githubLabels: (issue.labels ?? []).map((l: any) => typeof l === 'string' ? l : l.name),
            },
          };

          await taskService.createTask(dto, 'github-sync');
          created++;
        } catch (err: any) {
          errors.push(`Issue #${issue.number}: ${err.message}`);
        }
      }

      return {
        success: errors.length === 0,
        synced: tasks.length,
        created,
        updated,
        errors,
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

  /**
   * Verify HMAC-SHA256 signature of a GitHub webhook payload.
   *
   * GitHub sends `X-Hub-Signature-256: sha1=<hex>` or `sha256=<hex>`.
   * This method supports both sha1 and sha256.
   *
   * @param payload - Raw string body of the webhook request
   * @param signature - Value of the X-Hub-Signature-256 header
   * @returns true if signature is valid or verification is disabled
   */
  verifySignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret) {
      // No secret configured, skip verification
      return true;
    }

    if (!signature) {
      this.logger.warn('GitHub webhook: missing signature header, but secret is configured');
      return false;
    }

    const [algo, hash] = signature.split('=');
    if (!algo || !hash) {
      this.logger.warn('GitHub webhook: malformed signature header');
      return false;
    }

    try {
      const hmac = createHmac(algo, this.webhookSecret);
      hmac.update(payload);
      const expected = hmac.digest('hex');
      const result = expected === hash;
      if (!result) {
        this.logger.warn('GitHub webhook: HMAC signature verification failed');
      }
      return result;
    } catch (error: any) {
      this.logger.error(`GitHub webhook: HMAC verification error: ${error.message}`);
      return false;
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

        // Emit internal event for issue opened
        if (data.action === 'opened' && this.eventBus) {
          this.eventBus.emit({
            type: 'integration.github.issue.created',
            payload: {
              issueNumber: data.issue?.number,
              title: data.issue?.title,
              body: data.issue?.body,
              url: data.issue?.html_url,
              sender: data.sender?.login,
              repository: data.repository?.full_name,
              labels: (data.issue?.labels ?? []).map((l: any) => typeof l === 'string' ? l : l.name),
            },
            timestamp: new Date(),
            source: 'integration-github',
          });
        }
        break;

      case 'push':
        this.logger.info(`GitHub push: ${data.ref} by ${data.sender?.login}`);

        // Emit internal event for push
        if (this.eventBus) {
          this.eventBus.emit({
            type: 'integration.github.push',
            payload: {
              ref: data.ref,
              before: data.before,
              after: data.after,
              pushedBy: data.sender?.login,
              repository: data.repository?.full_name,
              commits: (data.commits ?? []).map((c: any) => ({
                id: c.id,
                message: c.message,
                author: c.author?.username,
                url: c.url,
              })),
              headCommit: data.head_commit ? {
                id: data.head_commit.id,
                message: data.head_commit.message,
                author: data.head_commit.author?.username,
                url: data.head_commit.url,
              } : undefined,
            },
            timestamp: new Date(),
            source: 'integration-github',
          });
        }
        break;

      case 'pull_request':
        this.logger.info(`GitHub PR ${data.action}: #${data.pull_request?.number}`);

        // Emit internal events for PR opened and PR merged
        if (this.eventBus) {
          if (data.action === 'opened') {
            this.eventBus.emit({
              type: 'integration.github.pr.opened',
              payload: {
                prNumber: data.pull_request?.number,
                title: data.pull_request?.title,
                body: data.pull_request?.body,
                url: data.pull_request?.html_url,
                sender: data.sender?.login,
                repository: data.repository?.full_name,
                baseBranch: data.pull_request?.base?.ref,
                headBranch: data.pull_request?.head?.ref,
              },
              timestamp: new Date(),
              source: 'integration-github',
            });
          } else if (data.action === 'closed' && data.pull_request?.merged) {
            this.eventBus.emit({
              type: 'integration.github.pr.merged',
              payload: {
                prNumber: data.pull_request?.number,
                title: data.pull_request?.title,
                url: data.pull_request?.html_url,
                sender: data.sender?.login,
                mergedBy: data.pull_request?.merged_by?.login,
                repository: data.repository?.full_name,
                baseBranch: data.pull_request?.base?.ref,
                headBranch: data.pull_request?.head?.ref,
                mergeCommitSha: data.pull_request?.merge_commit_sha,
              },
              timestamp: new Date(),
              source: 'integration-github',
            });
          }
        }
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
