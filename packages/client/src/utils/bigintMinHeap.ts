// Readonly so no one accidentally mutates the underlying array
// instead of using the specialized heap functions defined below.
export type BigintMinHeap = readonly bigint[];

export function sum(mh: BigintMinHeap): bigint {
  return mh.reduce((acc, val) => acc + val, 0n);
}

export function enqueue(mh: BigintMinHeap, element: bigint, maxLength: number) {
  if (maxLength <= 0) throw new Error("maxLength must be greater than zero");

  if (mh.length < maxLength) {
    (mh as bigint[]).push(element);
    siftUp(mh, mh.length - 1);
    return;
  }

  if (element <= mh[0]) return;

  (mh as bigint[])[0] = element;
  siftDown(mh, 0);
}

function siftUp(heap: BigintMinHeap, index: number): void {
  while (index > 0) {
    const parentIndex = Math.floor((index - 1) / 2);
    if (heap[index] >= heap[parentIndex]) break;
    [(heap as bigint[])[index], (heap as bigint[])[parentIndex]] = [heap[parentIndex], heap[index]];
    index = parentIndex;
  }
}

function siftDown(heap: BigintMinHeap, index: number): void {
  const length = heap.length;
  while (true) {
    let smallest = index;
    const left = 2 * index + 1;
    const right = 2 * index + 2;

    if (left < length && heap[left] < heap[smallest]) {
      smallest = left;
    }

    if (right < length && heap[right] < heap[smallest]) {
      smallest = right;
    }

    if (smallest === index) break;

    [(heap as bigint[])[index], (heap as bigint[])[smallest]] = [heap[smallest], heap[index]];
    index = smallest;
  }
}
