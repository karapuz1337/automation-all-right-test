import { writeFileSync } from 'node:fs';
import type { FullConfig, FullResult, Reporter, Suite, TestCase } from '@playwright/test/reporter';

export interface JobSummaryOptions {
  summaryFile: string;
}

const statuses = ['Passed', 'Failed', 'Flaky', 'Skipped', 'Interrupted', 'Not run'] as const;
type Status = typeof statuses[number];

function caseStatus(test: TestCase): Status {
  switch (test.outcome()) {
    case 'expected': return 'Passed';
    case 'unexpected': return 'Failed';
    case 'flaky': return 'Flaky';
    case 'skipped':
      if (test.results.some(result => result.status === 'interrupted')) return 'Interrupted';
      return test.expectedStatus === 'skipped' ? 'Skipped' : 'Not run';
  }
}

function counts(label: string, cases: { status: Status }[]): string {
  return `| ${label} | ${cases.length} | ${statuses.map(status =>
    cases.filter(test => test.status === status).length,
  ).join(' | ')} |`;
}

export default class JobSummaryReporter implements Reporter {
  private suite?: Suite;

  constructor(private readonly options: JobSummaryOptions) {}

  printsToStdio(): boolean {
    return false;
  }

  onBegin(_config: FullConfig, suite: Suite): void {
    this.suite = suite;
  }

  onEnd(result: FullResult): void {
    if (result.status === 'interrupted') return;

    const projects = (this.suite?.suites ?? []).map(suite => {
      const name = suite.project()?.name;
      const project = name === 'ui' || name === 'api' ? name : 'Other';
      const cases = suite.allTests().map(test => ({
        // Emit only the bounded acceptance ID, never arbitrary titles or result payloads.
        id: /^AC-(?:0[1-9]|1[0-3])\b/.exec(test.title)?.[0] ?? 'Unlabeled case',
        status: caseStatus(test),
      }));
      return { project, cases };
    });

    const outcome = { passed: 'Passed', failed: 'Failed', timedout: 'Timed out' }[result.status];
    const lines = [
      '## Playwright results',
      '',
      `Run status: **${outcome}**`,
      '',
      `| Project | Total | ${statuses.join(' | ')} |`,
      `| ${Array.from({ length: statuses.length + 2 }, () => '---').join(' | ')} |`,
      counts('All projects', projects.flatMap(({ cases }) => cases)),
      ...projects.map(({ project, cases }) => counts(project, cases)),
      '',
      '| Project | Case | Status |',
      '| --- | --- | --- |',
      ...projects.flatMap(({ project, cases }) => cases.map(({ id, status }) =>
        `| ${project} | ${id} | ${status} |`,
      )),
      '',
    ];
    writeFileSync(this.options.summaryFile, lines.join('\n'), 'utf8');
  }
}
