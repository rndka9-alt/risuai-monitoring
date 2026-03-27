import { useRef, useCallback, useEffect } from 'react';

const DRAG_THRESHOLD = 5;

export function useDragScroll() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const state = useRef({ pressing: false, dragged: false, startX: 0, scrollLeft: 0 });

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    state.current = { pressing: true, dragged: false, startX: e.clientX, scrollLeft: el.scrollLeft };
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!state.current.pressing) return;
      const el = scrollRef.current;
      if (!el) return;
      const dx = e.clientX - state.current.startX;
      if (Math.abs(dx) > DRAG_THRESHOLD) state.current.dragged = true;
      if (state.current.dragged) {
        e.preventDefault();
        el.scrollLeft = state.current.scrollLeft - dx;
      }
    };
    const onMouseUp = () => { state.current.pressing = false; };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (state.current.dragged) {
      e.stopPropagation();
    }
  }, []);

  return { scrollRef, onMouseDown, onClickCapture };
}
