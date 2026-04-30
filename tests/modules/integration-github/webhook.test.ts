import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { Logger } from '@/lib/core/logger';
import { EventBus } from '@/lib/core/event-bus';
import { GitHubAdapter } from '@/lib/modules/integration-github/github.adapter';

describe('GitHub Webhook Processing', () => {
  let adapter: GitHubAdapter;
  let logger: Logger;
  let eventBus: EventBus;
  let emitSpy: vi.spyOn;

  beforeEach(() => {
    logger = new Logger('test');
    eventBus = new EventBus();
    adapter = new GitHubAdapter(logger);
    adapter.setEventBus(eventBus);
    emitSpy = vi.spyOn(eventBus, 'emit');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Push event ---

  describe('push event', () => {
    it('should emit integration.github.push event', async () => {
      const payload = {
        ref: 'refs/heads/main',
        before: 'abc123',
        after: 'def456',
        sender: { login: 'octocat' },
        repository: { full_name: 'owner/repo' },
        commits: [
          { id: 'c1', message: 'fix: typo', author: { username: 'octocat' }, url: 'https://github.com/owner/repo/commit/c1' },
        ],
        head_commit: { id: 'c1', message: 'fix: typo', author: { username: 'octocat' }, url: 'https://github.com/owner/repo/commit/c1' },
      };

      await adapter.handleWebhook(payload, { 'x-github-event': 'push' });

      expect(emitSpy).toHaveBeenCalledTimes(1);
      const emitted = emitSpy.mock.calls[0][0];
      expect(emitted.type).toBe('integration.github.push');
      expect(emitted.source).toBe('integration-github');
      expect(emitted.payload.ref).toBe('refs/heads/main');
      expect(emitted.payload.pushedBy).toBe('octocat');
      expect(emitted.payload.repository).toBe('owner/repo');
      expect(emitted.payload.commits).toHaveLength(1);
      expect(emitted.payload.headCommit.id).toBe('c1');
    });

    it('should handle push with no commits gracefully', async () => {
      const payload = {
        ref: 'refs/heads/main',
        before: 'abc123',
        after: 'def456',
        sender: { login: 'octocat' },
        repository: { full_name: 'owner/repo' },
        commits: [],
      };

      await adapter.handleWebhook(payload, { 'x-github-event': 'push' });

      expect(emitSpy).toHaveBeenCalledTimes(1);
      const emitted = emitSpy.mock.calls[0][0];
      expect(emitted.payload.commits).toHaveLength(0);
      expect(emitted.payload.headCommit).toBeUndefined();
    });
  });

  // --- Pull Request opened event ---

  describe('pull_request opened event', () => {
    it('should emit integration.github.pr.opened event', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          number: 42,
          title: 'Add new feature',
          body: 'This PR adds a new feature',
          html_url: 'https://github.com/owner/repo/pull/42',
          base: { ref: 'main' },
          head: { ref: 'feature/new' },
        },
        sender: { login: 'developer' },
        repository: { full_name: 'owner/repo' },
      };

      await adapter.handleWebhook(payload, { 'x-github-event': 'pull_request' });

      expect(emitSpy).toHaveBeenCalledTimes(1);
      const emitted = emitSpy.mock.calls[0][0];
      expect(emitted.type).toBe('integration.github.pr.opened');
      expect(emitted.payload.prNumber).toBe(42);
      expect(emitted.payload.title).toBe('Add new feature');
      expect(emitted.payload.sender).toBe('developer');
      expect(emitted.payload.repository).toBe('owner/repo');
      expect(emitted.payload.baseBranch).toBe('main');
      expect(emitted.payload.headBranch).toBe('feature/new');
    });

    it('should not emit event for PR closed without merge', async () => {
      const payload = {
        action: 'closed',
        pull_request: {
          number: 42,
          title: 'Add new feature',
          merged: false,
        },
        sender: { login: 'developer' },
        repository: { full_name: 'owner/repo' },
      };

      await adapter.handleWebhook(payload, { 'x-github-event': 'pull_request' });

      expect(emitSpy).not.toHaveBeenCalled();
    });
  });

  // --- Pull Request merged event ---

  describe('pull_request merged event', () => {
    it('should emit integration.github.pr.merged event when PR is closed with merged=true', async () => {
      const payload = {
        action: 'closed',
        pull_request: {
          number: 42,
          title: 'Add new feature',
          html_url: 'https://github.com/owner/repo/pull/42',
          merged: true,
          merged_by: { login: 'maintainer' },
          merge_commit_sha: 'merge-sha-123',
          base: { ref: 'main' },
          head: { ref: 'feature/new' },
        },
        sender: { login: 'developer' },
        repository: { full_name: 'owner/repo' },
      };

      await adapter.handleWebhook(payload, { 'x-github-event': 'pull_request' });

      expect(emitSpy).toHaveBeenCalledTimes(1);
      const emitted = emitSpy.mock.calls[0][0];
      expect(emitted.type).toBe('integration.github.pr.merged');
      expect(emitted.payload.prNumber).toBe(42);
      expect(emitted.payload.title).toBe('Add new feature');
      expect(emitted.payload.mergedBy).toBe('maintainer');
      expect(emitted.payload.mergeCommitSha).toBe('merge-sha-123');
      expect(emitted.payload.repository).toBe('owner/repo');
    });
  });

  // --- Issue created event ---

  describe('issue created event', () => {
    it('should emit integration.github.issue.created event', async () => {
      const payload = {
        action: 'opened',
        issue: {
          number: 10,
          title: 'Bug: login fails',
          body: 'Login page returns 500',
          html_url: 'https://github.com/owner/repo/issues/10',
          labels: [{ name: 'bug' }, { name: 'urgent' }],
        },
        sender: { login: 'reporter' },
        repository: { full_name: 'owner/repo' },
      };

      await adapter.handleWebhook(payload, { 'x-github-event': 'issues' });

      expect(emitSpy).toHaveBeenCalledTimes(1);
      const emitted = emitSpy.mock.calls[0][0];
      expect(emitted.type).toBe('integration.github.issue.created');
      expect(emitted.payload.issueNumber).toBe(10);
      expect(emitted.payload.title).toBe('Bug: login fails');
      expect(emitted.payload.url).toBe('https://github.com/owner/repo/issues/10');
      expect(emitted.payload.sender).toBe('reporter');
      expect(emitted.payload.repository).toBe('owner/repo');
      expect(emitted.payload.labels).toEqual(['bug', 'urgent']);
    });

    it('should not emit event for issue edited', async () => {
      const payload = {
        action: 'edited',
        issue: { number: 10, title: 'Updated title' },
        sender: { login: 'editor' },
        repository: { full_name: 'owner/repo' },
      };

      await adapter.handleWebhook(payload, { 'x-github-event': 'issues' });

      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('should not emit event for issue closed', async () => {
      const payload = {
        action: 'closed',
        issue: { number: 10, title: 'Closed issue' },
        sender: { login: 'closer' },
        repository: { full_name: 'owner/repo' },
      };

      await adapter.handleWebhook(payload, { 'x-github-event': 'issues' });

      expect(emitSpy).not.toHaveBeenCalled();
    });
  });

  // --- Unknown event types ---

  describe('unknown event types', () => {
    it('should handle unknown event types gracefully without throwing', async () => {
      await expect(
        adapter.handleWebhook({}, { 'x-github-event': 'deployment' })
      ).resolves.not.toThrow();

      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('should handle missing event header gracefully', async () => {
      await expect(
        adapter.handleWebhook({})
      ).resolves.not.toThrow();

      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('should handle PR synchronize action without emitting', async () => {
      const payload = {
        action: 'synchronize',
        pull_request: { number: 42, title: 'Updated PR' },
        sender: { login: 'developer' },
        repository: { full_name: 'owner/repo' },
      };

      await adapter.handleWebhook(payload, { 'x-github-event': 'pull_request' });

      expect(emitSpy).not.toHaveBeenCalled();
    });
  });

  // --- No EventBus ---

  describe('without EventBus', () => {
    it('should not throw when EventBus is not set', async () => {
      const noBusAdapter = new GitHubAdapter(logger);

      await expect(
        noBusAdapter.handleWebhook(
          { action: 'opened', issue: { number: 1, title: 'Test' } },
          { 'x-github-event': 'issues' },
        )
      ).resolves.not.toThrow();
    });
  });

  // --- HMAC signature verification ---

  describe('HMAC signature verification', () => {
    it('should return true when no secret is configured', () => {
      const noSecretAdapter = new GitHubAdapter(logger);
      expect(noSecretAdapter.verifySignature('any-payload', 'any-signature')).toBe(true);
    });

    it('should return false when secret is set but signature is missing', () => {
      const secureAdapter = new GitHubAdapter(logger, { webhookSecret: 'my-secret' });
      expect(secureAdapter.verifySignature('payload', '')).toBe(false);
    });

    it('should return false for malformed signature', () => {
      const secureAdapter = new GitHubAdapter(logger, { webhookSecret: 'my-secret' });
      expect(secureAdapter.verifySignature('payload', 'no-equal-sign')).toBe(false);
    });

    it('should verify sha256 signature correctly', () => {
      const secret = 'test-secret-key';
      const payload = '{"test": "data"}';
      const secureAdapter = new GitHubAdapter(logger, { webhookSecret: secret });

      const signature = 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');

      expect(secureAdapter.verifySignature(payload, signature)).toBe(true);
    });

    it('should reject tampered payload', () => {
      const secret = 'test-secret-key';
      const payload = '{"test": "data"}';
      const secureAdapter = new GitHubAdapter(logger, { webhookSecret: secret });

      const signature = 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');

      expect(secureAdapter.verifySignature('{"test": "tampered"}', signature)).toBe(false);
    });

    it('should verify sha1 signature correctly', () => {
      const secret = 'test-secret-key';
      const payload = '{"test": "data"}';
      const secureAdapter = new GitHubAdapter(logger, { webhookSecret: secret });

      const signature = 'sha1=' + createHmac('sha1', secret).update(payload).digest('hex');

      expect(secureAdapter.verifySignature(payload, signature)).toBe(true);
    });

    it('should read secret from GITHUB_WEBHOOK_SECRET env', () => {
      const originalEnv = process.env.GITHUB_WEBHOOK_SECRET;
      process.env.GITHUB_WEBHOOK_SECRET = 'env-secret';
      try {
        const envAdapter = new GitHubAdapter(logger);
        const payload = '{"test": "data"}';
        const signature = 'sha256=' + createHmac('sha256', 'env-secret').update(payload).digest('hex');

        expect(envAdapter.verifySignature(payload, signature)).toBe(true);
      } finally {
        process.env.GITHUB_WEBHOOK_SECRET = originalEnv;
      }
    });
  });
});
