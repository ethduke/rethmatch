export function heapifyPacked(raw: readonly bigint[]): PQ96x160 {
  return raw.map(unpack);
}

export function unpack(packed: bigint): PQ96x160Entry {
  return {
    priority: packed >> 160n,
    value: packed & 0x000000000000000000000000ffffffffffffffffffffffffffffffffffffffffn,
  };
}

export type PQ96x160Entry = {
  priority: bigint;
  value: bigint;
};

// Readonly so no one accidentally mutates the underlying array
// instead of using the specialized heap functions defined below.
export type PQ96x160 = readonly PQ96x160Entry[];

export function peek(pq: PQ96x160): PQ96x160Entry | undefined {
  return pq[0];
}

export function push(pq: PQ96x160, element: PQ96x160Entry): boolean {
  _sortNodeUp(pq as PQ96x160Entry[], (pq as PQ96x160Entry[]).push(element) - 1);
  return true;
}

export function pop(pq: PQ96x160): PQ96x160Entry | undefined {
  const last = (pq as PQ96x160Entry[]).pop();
  if (pq.length > 0 && last !== undefined) {
    return replace(pq, last);
  }
  return last;
}

export function replace(pq: PQ96x160, element: PQ96x160Entry): PQ96x160Entry {
  const peek = pq[0];
  (pq as PQ96x160Entry[])[0] = element;
  _sortNodeDown(pq, 0);
  return peek;
}

// Internal functions:

function _sortNodeDown(pq: PQ96x160, i: number): void {
  let moveIt = i < pq.length - 1;
  const self = pq[i];

  const getPotentialParent = (best: number, j: number) => {
    if (pq.length > j && pq[j].priority - pq[best].priority < 0n) {
      best = j;
    }
    return best;
  };

  while (moveIt) {
    const childrenIdx = _getChildrenIndexOf(i);
    const bestChildIndex = childrenIdx.reduce(getPotentialParent, childrenIdx[0]);
    const bestChild = pq[bestChildIndex];
    if (typeof bestChild !== "undefined" && self.priority - bestChild.priority > 0n) {
      _moveNode(pq, i, bestChildIndex);
      i = bestChildIndex;
    } else {
      moveIt = false;
    }
  }
}

function _sortNodeUp(pq: PQ96x160, i: number): void {
  let moveIt = i > 0;
  while (moveIt) {
    const pi = _getParentIndexOf(i);
    if (pi >= 0 && pq[pi].priority - pq[i].priority > 0n) {
      _moveNode(pq, i, pi);
      i = pi;
    } else {
      moveIt = false;
    }
  }
}

function _moveNode(pq: PQ96x160, j: number, k: number): void {
  [(pq as PQ96x160Entry[])[j], (pq as PQ96x160Entry[])[k]] = [pq[k], pq[j]];
}

function _getChildrenIndexOf(idx: number): Array<number> {
  return [idx * 2 + 1, idx * 2 + 2];
}

function _getParentIndexOf(idx: number): number {
  if (idx <= 0) {
    return -1;
  }
  const whichChildren = idx % 2 ? 1 : 2;
  return Math.floor((idx - whichChildren) / 2);
}
