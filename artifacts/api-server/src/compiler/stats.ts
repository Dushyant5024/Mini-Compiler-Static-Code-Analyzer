interface RunRecord {
  tokenizationMs: number;
  parseMs: number;
  optimizationMs: number;
  maintainabilityScore: number;
  issueTypes: string[];
}

const runHistory: RunRecord[] = [];

export function recordRun(record: RunRecord): void {
  runHistory.push(record);
  // Keep only last 1000 runs
  if (runHistory.length > 1000) runHistory.shift();
}

export function getStats() {
  const total = runHistory.length;
  if (total === 0) {
    return {
      totalRuns: 0,
      avgTokenizationMs: 0,
      avgParseMs: 0,
      avgOptimizationMs: 0,
      avgMaintainabilityScore: 0,
      topIssueTypes: [],
    };
  }

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const avg = (arr: number[]) => arr.length > 0 ? sum(arr) / arr.length : 0;

  const issueCount = new Map<string, number>();
  for (const run of runHistory) {
    for (const type of run.issueTypes) {
      issueCount.set(type, (issueCount.get(type) ?? 0) + 1);
    }
  }

  const topIssueTypes = Array.from(issueCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([type, count]) => ({ type, count }));

  return {
    totalRuns: total,
    avgTokenizationMs: Math.round(avg(runHistory.map(r => r.tokenizationMs)) * 100) / 100,
    avgParseMs: Math.round(avg(runHistory.map(r => r.parseMs)) * 100) / 100,
    avgOptimizationMs: Math.round(avg(runHistory.map(r => r.optimizationMs)) * 100) / 100,
    avgMaintainabilityScore: Math.round(avg(runHistory.map(r => r.maintainabilityScore))),
    topIssueTypes,
  };
}
