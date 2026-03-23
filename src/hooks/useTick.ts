import { useState, useEffect } from 'react';

/** 매 intervalMs마다 Date.now()를 반환하는 훅. 시간 기반 텍스트 갱신용. */
export function useTick(intervalMs: number = 1_000): number {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
