import type { MergedTabPair, TerminalTab } from "@/types/workspace";

export const getMergedTabName = (leftName: string, rightName: string) => {
  const leftTabMatch = leftName.match(/^Tab\s+(.+)$/i);
  const rightTabMatch = rightName.match(/^Tab\s+(.+)$/i);

  if (leftTabMatch && rightTabMatch) {
    return `Tab ${leftTabMatch[1]}&${rightTabMatch[1]}`;
  }

  return `${leftName}&${rightName}`;
};

export const getMergedTabPairForTab = (
  tabId: string,
  mergedTabPairs: readonly MergedTabPair[]
) => mergedTabPairs.find(pair => pair.includes(tabId)) ?? null;

export const getMergedSecondaryTabIds = (mergedTabPairs: readonly MergedTabPair[]) => {
  return new Set(mergedTabPairs.map(([, secondaryId]) => secondaryId));
};

export const pruneMergedTabPairs = (
  mergedTabPairs: readonly MergedTabPair[],
  tabs: readonly TerminalTab[]
) => {
  const tabIds = new Set(tabs.map(tab => tab.id));
  const usedTabIds = new Set<string>();

  return mergedTabPairs.filter(([leftId, rightId]) => {
    if (leftId === rightId || !tabIds.has(leftId) || !tabIds.has(rightId)) return false;
    if (usedTabIds.has(leftId) || usedTabIds.has(rightId)) return false;

    usedTabIds.add(leftId);
    usedTabIds.add(rightId);
    return true;
  });
};

export const mergeTabPair = (
  mergedTabPairs: readonly MergedTabPair[],
  primaryTabId: string,
  secondaryTabId: string
) => {
  if (primaryTabId === secondaryTabId) return [...mergedTabPairs];

  const retainedPairs = mergedTabPairs.filter(
    pair => !pair.includes(primaryTabId) && !pair.includes(secondaryTabId)
  );

  return [...retainedPairs, [primaryTabId, secondaryTabId] as MergedTabPair];
};

export const unmergeTabPair = (
  mergedTabPairs: readonly MergedTabPair[],
  tabId: string
) => mergedTabPairs.filter(pair => !pair.includes(tabId));
