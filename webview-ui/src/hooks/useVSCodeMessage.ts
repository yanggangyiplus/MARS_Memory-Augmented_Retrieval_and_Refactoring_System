import { useEffect, useCallback } from 'react';
import type { ExtensionMessage } from '../types';

/**
 * Extension으로부터 메시지를 수신하는 React Hook.
 * 컴포넌트 마운트 시 이벤트 리스너를 등록하고, 언마운트 시 해제합니다.
 */
export function useVSCodeMessage(handler: (message: ExtensionMessage) => void): void {
  const stableHandler = useCallback(handler, [handler]);

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const message = event.data as ExtensionMessage;
      if (message && message.type) {
        stableHandler(message);
      }
    };

    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [stableHandler]);
}
