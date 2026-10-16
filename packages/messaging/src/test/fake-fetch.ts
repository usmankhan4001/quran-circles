import type { FetchLike, HttpRequestInit, HttpResponseLike } from '../http';

export interface RecordedRequest {
  url: string;
  init: HttpRequestInit;
}

export interface ScriptedResponse {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

/** A fetch that never touches the network: answers from a script and records every request. */
export function createFakeFetch(
  respond: (request: RecordedRequest, index: number) => ScriptedResponse | Error,
): FetchLike & { requests: RecordedRequest[] } {
  const requests: RecordedRequest[] = [];
  const fn = ((url: string, init: HttpRequestInit = {}) => {
    const request = { url, init };
    requests.push(request);
    const answer = respond(request, requests.length - 1);
    if (answer instanceof Error) return Promise.reject(answer);
    const headers = new Map(
      Object.entries(answer.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
    );
    const text =
      answer.body === undefined
        ? ''
        : typeof answer.body === 'string'
          ? answer.body
          : JSON.stringify(answer.body);
    const response: HttpResponseLike = {
      status: answer.status,
      headers: { get: (name) => headers.get(name.toLowerCase()) ?? null },
      text: () => Promise.resolve(text),
    };
    return Promise.resolve(response);
  }) as FetchLike & { requests: RecordedRequest[] };
  fn.requests = requests;
  return fn;
}

export const bodyOf = (request: RecordedRequest): unknown =>
  JSON.parse(typeof request.init.body === 'string' ? request.init.body : '{}');
