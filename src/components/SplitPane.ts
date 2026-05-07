/**
 * Makes divider elements draggable to resize adjacent panels.
 */
export function initSplitPanes(): void {
  // Horizontal divider: editor (left) | right-pane
  initHorizontalDivider(
    document.getElementById('h-divider')!,
    document.getElementById('editor-pane')!,
    document.getElementById('right-pane')!,
  );

  // Vertical divider: tree-pane (top) | properties-pane (bottom)
  initVerticalDivider(
    document.getElementById('v-divider')!,
    document.getElementById('tree-pane')!,
    document.getElementById('properties-pane')!,
  );
}

function initHorizontalDivider(
  divider: HTMLElement,
  left: HTMLElement,
  _right: HTMLElement,
): void {
  let startX = 0;
  let startWidth = 0;

  divider.addEventListener('mousedown', (e: MouseEvent) => {
    e.preventDefault();
    startX = e.clientX;
    startWidth = left.getBoundingClientRect().width;
    divider.classList.add('dragging');

    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - startX;
      const parent = divider.parentElement!;
      const parentWidth = parent.getBoundingClientRect().width;
      const newWidth = Math.max(150, Math.min(parentWidth - 200, startWidth + dx));
      left.style.width = `${newWidth}px`;
      left.style.flex = 'none';
    };

    const onUp = () => {
      divider.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

function initVerticalDivider(
  divider: HTMLElement,
  top: HTMLElement,
  _bottom: HTMLElement,
): void {
  let startY = 0;
  let startHeight = 0;

  divider.addEventListener('mousedown', (e: MouseEvent) => {
    e.preventDefault();
    startY = e.clientY;
    startHeight = top.getBoundingClientRect().height;
    divider.classList.add('dragging');

    const onMove = (e: MouseEvent) => {
      const dy = e.clientY - startY;
      const parent = divider.parentElement!;
      const parentHeight = parent.getBoundingClientRect().height;
      const newHeight = Math.max(80, Math.min(parentHeight - 80, startHeight + dy));
      top.style.height = `${newHeight}px`;
      top.style.flex = 'none';
    };

    const onUp = () => {
      divider.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}
