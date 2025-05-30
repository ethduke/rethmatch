// Efficiently calculates if a line is visible or partially visible
// within the lines container. Uses totalHeight to avoid touching dom.
export function calculateLineVisibility(
  totalHeightExclusive: number,
  totalHeightInclusive: number,
  containerHeight: number,
  scrollTop: number
) {
  const isVisible =
    totalHeightExclusive < scrollTop + containerHeight && totalHeightInclusive > scrollTop;

  const isOnlyPartiallyVisible =
    (totalHeightExclusive < scrollTop && totalHeightInclusive > scrollTop) ||
    (totalHeightExclusive < scrollTop + containerHeight &&
      totalHeightInclusive > scrollTop + containerHeight);

  return { isVisible, isOnlyPartiallyVisible };
}

// NOTE: Ensure there is a corresponding CSS anim
// class for every color you pass to this function!
export function colorToGlowClass(color: string) {
  return `glow${color.toLowerCase().slice(1)}`;
}

export function centerLineInViewport(lineId: number) {
  setTimeout(() => {
    document.getElementById(`line-${lineId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, 1);
}
