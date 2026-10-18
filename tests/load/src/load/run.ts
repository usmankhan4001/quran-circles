import type { Api, Person } from '../people';
import { pushBurst, type DrainProbe, type PushBurstResult } from './push';
import { performance } from 'node:perf_hooks';
import { Recorder } from '../stats';
import {
  checkThresholds,
  refreshTokens,
  runStep,
  type StepResult,
  type ThresholdCheck,
} from './runner';
import type { ScenarioFile } from './scenario';
import type { EveningData } from './seed';

/** Optional database sampler (local runs only). */
export interface StepSampler<T> {
  start(): Promise<void>;
  stop(): Promise<T>;
}

export interface StepReport<T> {
  step: StepResult;
  push: PushBurstResult | null;
  db: T | null;
  thresholds: ThresholdCheck[];
  pass: boolean;
}

export interface LoadReport<T> {
  baseUrl: string;
  provisional: boolean;
  startedAt: string;
  finishedAt: string;
  seed: { runTag: string; venues: number; sessions: number; users: number; bulkPushUsers: number };
  steps: StepReport<T>[];
}

export async function runEvening<T>(options: {
  api: Api;
  admin: Person;
  scenario: ScenarioFile;
  data: EveningData;
  probe: DrainProbe | null;
  sampler?: StepSampler<T>;
  bulkPushUsers?: number;
  steps?: ScenarioFile['steps'];
  log?: (line: string) => void;
}): Promise<LoadReport<T>> {
  const log = options.log ?? (() => undefined);
  const { api, admin, scenario, data } = options;
  const startedAt = new Date().toISOString();
  const reports: StepReport<T>[] = [];
  for (const step of options.steps ?? scenario.steps) {
    log(`step: ${step.vus} VUs for ${step.durationS} s`);
    await options.sampler?.start();
    // The push burst starts `atS` into the step and runs alongside the VUs; its drain is followed
    // to the end, but the step's latency and database figures cover only the VUs' window.
    const loadEndsAt = performance.now() + (scenario.rampS + step.durationS) * 1000;
    const burst: Promise<PushBurstResult | null> = options.probe
      ? (async () => {
          await new Promise((done) => setTimeout(done, scenario.pushBurst.atS * 1000));
          await refreshTokens({ baseUrl: api.baseUrl, recorder: new Recorder() }, admin);
          return pushBurst(api, admin, options.probe as DrainProbe, {
            label: `${data.runTag} ${step.vus}vu`,
            loadEndsAt,
          });
        })()
      : Promise.resolve(null);
    const result = await runStep(
      {
        baseUrl: api.baseUrl,
        scenario,
        cityId: data.cityId,
        areaIds: data.areaIds,
        center: data.center,
        sessionIds: data.sessionIds,
        users: data.users,
      },
      { vus: step.vus, durationS: scenario.rampS + step.durationS },
      scenario.rampS,
    );
    const db = options.sampler ? await options.sampler.stop() : null;
    if (options.probe) log('  waiting for the push burst to drain');
    const pushResult = await burst;
    const thresholds = checkThresholds(scenario, result, pushResult);
    reports.push({
      step: result,
      push: pushResult,
      db,
      thresholds,
      pass: thresholds.every((t) => t.pass),
    });
    const failed = thresholds.filter((t) => !t.pass).map((t) => t.name);
    log(
      `  ${result.requests} requests, ${result.rps} req/s, p95 ${result.overall.p95} ms, ` +
        `failed ${(result.failedRate * 100).toFixed(2)}%` +
        (pushResult
          ? `; push ${pushResult.rowsQueued} rows, post ${pushResult.postMs} ms, drained in ${pushResult.allSentS ?? 'timeout'} s` +
            (pushResult.perUpdate ? '' : ' (global counts)') +
            (pushResult.timeline
              ? ` (written ${pushResult.timeline.writtenS ?? '-'} s, last sent ${pushResult.timeline.lastSentS ?? '-'} s, ` +
                `${pushResult.timeline.sendPerSecond ?? '-'} /s from the first send)`
              : '')
          : '') +
        (failed.length ? `; over threshold: ${failed.join(', ')}` : '; within thresholds'),
    );
  }
  return {
    baseUrl: api.baseUrl,
    provisional: true,
    startedAt,
    finishedAt: new Date().toISOString(),
    seed: {
      runTag: data.runTag,
      venues: data.venueIds.length,
      sessions: data.sessionIds.length,
      users: data.users.length,
      bulkPushUsers: options.bulkPushUsers ?? 0,
    },
    steps: reports,
  };
}
