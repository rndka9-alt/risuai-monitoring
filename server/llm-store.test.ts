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

  it('expire 후 end 이벤트가 오면 중복 없이 기존 항목을 업데이트한다', () => {
    handleLlmEvent(makeStartEvent('stream-a', {
      targetCharId: 'char-1',
      requestBody: JSON.stringify({ model: 'gpt-4', messages: [] }),
    }));
    expireStream('stream-a', 'not found in sync');

    // expire 후 실제 end 이벤트 도착
    handleLlmEvent(makeEndEvent('stream-a', {
      duration: 5000,
      textLength: 100,
      outputPreview: 'result text',
      finishReason: 'stop',
      outputTokens: 50,
    }));

    const { active, recent } = getStreams();
    expect(active).toHaveLength(0);
    // 중복 없이 1개만 존재
    expect(recent).toHaveLength(1);
    expect(recent[0].id).toBe('stream-a');
    // end 이벤트의 status로 업데이트됨
    expect(recent[0].status).toBe('completed');
    // start 이벤트의 원본 데이터 유지
    expect(recent[0].model).toBe('gpt-4');
    expect(recent[0].targetCharId).toBe('char-1');
    // end 이벤트의 데이터 반영
    expect(recent[0].finishReason).toBe('stop');
    expect(recent[0].outputTokens).toBe(50);
  });
});
