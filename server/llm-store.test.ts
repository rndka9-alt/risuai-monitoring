import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  handleLlmEvent,
  getStreams,
  heartbeat,
  expireStream,
  _resetForTest,
} from './llm-store.js';
import type { FetchActiveIds } from './llm-store.js';

function makeStartEvent(streamId: string, overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    type: 'start',
    streamId,
    sender: 'test-sender',
    targetUrl: 'https://api.example.com/v1/chat',
    requestBody: JSON.stringify({ model: 'gpt-4', messages: [{ role: 'user', content: 'hi' }] }),
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeEndEvent(streamId: string, overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    type: 'end',
    streamId,
    duration: 1234,
    textLength: 42,
    outputPreview: 'hello world',
    status: 200,
    ...overrides,
  };
}

describe('llm-store heartbeat', () => {
  beforeEach(() => {
    _resetForTest();
  });

  it('active stream이 없으면 heartbeat가 아무것도 하지 않는다', async () => {
    const fetch = vi.fn<FetchActiveIds>();
    await heartbeat(fetch);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sync에 없는 active stream을 failed로 만료시킨다', async () => {
    handleLlmEvent(makeStartEvent('stream-a'));
    handleLlmEvent(makeStartEvent('stream-b'));

    // sync는 stream-a만 알고 있음
    const fetch: FetchActiveIds = () => Promise.resolve(new Set(['stream-a']));
    await heartbeat(fetch);

    const { active, recent } = getStreams();
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('stream-a');
    expect(recent).toHaveLength(1);
    expect(recent[0].id).toBe('stream-b');
    expect(recent[0].status).toBe('failed');
    expect(recent[0].error).toBe('not found in sync');
  });

  it('sync가 모든 active stream을 알면 아무것도 만료시키지 않는다', async () => {
    handleLlmEvent(makeStartEvent('stream-a'));
    handleLlmEvent(makeStartEvent('stream-b'));

    const fetch: FetchActiveIds = () => Promise.resolve(new Set(['stream-a', 'stream-b']));
    await heartbeat(fetch);

    const { active, recent } = getStreams();
    expect(active).toHaveLength(2);
    expect(recent).toHaveLength(0);
  });

  it('sync 응답 불가 시 만료시키지 않는다 (안전)', async () => {
    handleLlmEvent(makeStartEvent('stream-a'));

    const fetch: FetchActiveIds = () => Promise.resolve(null);
    await heartbeat(fetch);

    const { active } = getStreams();
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('stream-a');
  });

  it('streamMaxAgeMs 초과 시 sync 응답과 무관하게 만료시킨다', async () => {
    // 2시간 전에 생성된 스트림
    const twoHoursAgo = Date.now() - 2 * 60 * 60_000;
    handleLlmEvent(makeStartEvent('zombie', { timestamp: twoHoursAgo }));

    // sync가 "네 살아잇어요~"라고 해도 max age 초과면 만료
    const fetch: FetchActiveIds = () => Promise.resolve(new Set(['zombie']));
    await heartbeat(fetch);

    const { active, recent } = getStreams();
    expect(active).toHaveLength(0);
    expect(recent).toHaveLength(1);
    expect(recent[0].error).toBe('max age exceeded');
  });

  it('이미 end 이벤트로 완료된 stream은 heartbeat 대상이 아니다', async () => {
    handleLlmEvent(makeStartEvent('stream-a'));
    handleLlmEvent(makeEndEvent('stream-a'));

    const fetch = vi.fn<FetchActiveIds>();
    await heartbeat(fetch);

    // active가 없으니 fetch 자체를 호출하지 않음
    expect(fetch).not.toHaveBeenCalled();
    const { active, recent } = getStreams();
    expect(active).toHaveLength(0);
    expect(recent).toHaveLength(1);
    expect(recent[0].status).toBe('completed');
  });
});

describe('expireStream', () => {
  beforeEach(() => {
    _resetForTest();
  });

  it('active stream을 failed recent로 이동시킨다', () => {
    handleLlmEvent(makeStartEvent('stream-a'));
    expireStream('stream-a', 'test reason');

    const { active, recent } = getStreams();
    expect(active).toHaveLength(0);
    expect(recent).toHaveLength(1);
    expect(recent[0].id).toBe('stream-a');
    expect(recent[0].status).toBe('failed');
    expect(recent[0].error).toBe('test reason');
    expect(recent[0].completedAt).toBeGreaterThan(0);
  });

  it('존재하지 않는 stream에 대해 아무것도 하지 않는다', () => {
    expireStream('nonexistent', 'whatever');
    const { active, recent } = getStreams();
    expect(active).toHaveLength(0);
    expect(recent).toHaveLength(0);
  });

  it('만료된 stream의 elapsedMs는 생성~만료 시점 차이다', () => {
    const fiveMinAgo = Date.now() - 5 * 60_000;
    handleLlmEvent(makeStartEvent('stream-a', { timestamp: fiveMinAgo }));
    expireStream('stream-a', 'timeout');

    const { recent } = getStreams();
    // 약 5분 (±100ms 허용)
    expect(recent[0].elapsedMs).toBeGreaterThan(4.9 * 60_000);
    expect(recent[0].elapsedMs).toBeLessThan(5.1 * 60_000);
  });
});
