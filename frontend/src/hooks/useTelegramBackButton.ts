import { useEffect, useRef } from "react";
import { isTelegramWebApp } from "../lib/api";

type StackEntry = {
  id: number;
  onBack: () => void;
};

let nextId = 1;
const stack: StackEntry[] = [];
let listenerAttached = false;

function getBackButton() {
  return window.Telegram?.WebApp?.BackButton ?? null;
}

function onTelegramBack() {
  const top = stack[stack.length - 1];
  top?.onBack();
}

function syncTelegramBackButton() {
  const backButton = getBackButton();
  if (!backButton) return;

  if (stack.length === 0) {
    if (listenerAttached) {
      backButton.offClick(onTelegramBack);
      listenerAttached = false;
    }
    backButton.hide();
    return;
  }

  if (!listenerAttached) {
    backButton.onClick(onTelegramBack);
    listenerAttached = true;
  }
  backButton.show();
}

function pushBackHandler(onBack: () => void): number {
  const id = nextId++;
  stack.push({ id, onBack });
  syncTelegramBackButton();
  return id;
}

function popBackHandler(id: number) {
  const index = stack.findIndex((item) => item.id === id);
  if (index >= 0) stack.splice(index, 1);
  syncTelegramBackButton();
}

/**
 * Show Telegram Mini App native BackButton (replaces Close) while mounted.
 * Nested headers (e.g. sheet over page) stack correctly — Close returns only
 * when the last back-capable screen unmounts.
 */
export function useTelegramBackButton(onBack: () => void, enabled = true): void {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!enabled || !isTelegramWebApp()) return;
    if (!getBackButton()) return;

    const stable = () => onBackRef.current();
    const id = pushBackHandler(stable);
    return () => popBackHandler(id);
  }, [enabled]);
}
