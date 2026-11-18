import { Box, Button, Center, Group, Loader, Modal, Stack, Text } from '@mantine/core';
import { useElementSize } from '@mantine/hooks';
import {
  IconArrowUpRight,
  IconCircle,
  IconMaximize,
  IconRotate2,
  IconRotateClockwise2,
  IconTrash,
} from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import {
  FULL_CROP,
  dragCrop,
  isFullCrop,
  rotateCrop,
  turn,
  type CropHandle,
  type CropRect,
  type Rotation,
} from '../lib/crop.js';
import { editToJpeg } from '../lib/images.js';
import {
  MARK_COLOR,
  markGeometry,
  moveMark,
  newArrow,
  newCircle,
  rotateMark,
  type PhotoMark,
} from '../lib/marks.js';
import type { PhotoEdit } from '../platform/photos.js';

/** Preview size: enough for the screen, small enough to turn quickly. */
const PREVIEW_SIDE = 1400;
const HANDLES: Exclude<CropHandle, 'move'>[] = ['nw', 'ne', 'sw', 'se'];
const HANDLE_SIZE = 44;

/**
 * Photo editor shown right after a photo is taken: turn by 90°, cut out a part and point at the
 * defect with a red arrow or circle. Returns the chosen edit (applied later to the original
 * photo, the marks drawn into it) or null when the technician drops the photo.
 */
export function usePhotoEditor(): {
  editor: ReactNode;
  edit: (file: Blob) => Promise<PhotoEdit | null>;
} {
  const [open, setOpen] = useState<{ file: Blob; resolve: (e: PhotoEdit | null) => void } | null>(
    null,
  );
  const edit = useCallback(
    (file: Blob) => new Promise<PhotoEdit | null>((resolve) => setOpen({ file, resolve })),
    [],
  );
  const finish = (result: PhotoEdit | null) => {
    open?.resolve(result);
    setOpen(null);
  };
  const editor = (
    <Modal
      opened={open !== null}
      onClose={() => finish(null)}
      fullScreen
      zIndex={400}
      title="Upravit fotku"
      styles={{ body: { padding: 'var(--mantine-spacing-sm)' } }}
    >
      {open && <EditorBody file={open.file} onDone={finish} />}
    </Modal>
  );
  return { editor, edit };
}

function EditorBody({ file, onDone }: { file: Blob; onDone: (e: PhotoEdit | null) => void }) {
  const [rotation, setRotation] = useState<Rotation>(0);
  const [crop, setCrop] = useState<CropRect>(FULL_CROP);
  const [preview, setPreview] = useState<{
    url: string;
    rotation: Rotation;
    width: number;
    height: number;
  } | null>(null);
  const area = useElementSize();
  const [failed, setFailed] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ handle: CropHandle; x: number; y: number; start: CropRect } | null>(null);
  const [marks, setMarks] = useState<PhotoMark[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const markDrag = useRef<{
    index: number;
    part: 'body' | 'end';
    x: number;
    y: number;
    start: PhotoMark;
  } | null>(null);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    editToJpeg(file, { rotation, crop: FULL_CROP }, PREVIEW_SIDE, 0.8)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        const image = new Image();
        const shown = url;
        image.onload = () =>
          !cancelled &&
          setPreview({
            url: shown,
            rotation,
            width: image.naturalWidth,
            height: image.naturalHeight,
          });
        image.onerror = () => !cancelled && setFailed(true);
        image.src = url;
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file, rotation]);

  const rotate = (clockwise: boolean) => {
    setRotation((r) => turn(r, clockwise));
    setCrop((c) => rotateCrop(c, clockwise));
    setMarks((list) => list.map((m) => rotateMark(m, clockwise)));
  };

  /** A new mark in the middle of the cut-out, selected for moving. */
  const addMark = (kind: PhotoMark['kind']) => {
    if (!preview) return;
    const cx = crop.x + crop.w / 2;
    const cy = crop.y + crop.h / 2;
    const mark =
      kind === 'arrow' ? newArrow(cx, cy, preview.width, preview.height) : newCircle(cx, cy);
    setMarks((list) => [...list, mark]);
    setSelected(marks.length);
  };

  const startMark = (index: number, part: 'body' | 'end') => (event: PointerEvent<SVGElement>) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelected(index);
    markDrag.current = { index, part, x: event.clientX, y: event.clientY, start: marks[index]! };
  };
  const moveMarkPointer = (event: PointerEvent<SVGElement>) => {
    const current = markDrag.current;
    const box = frame.current?.getBoundingClientRect();
    if (!current || !box || !preview) return;
    const dx = (event.clientX - current.x) / box.width;
    const dy = (event.clientY - current.y) / box.height;
    const start = current.start;
    let next: PhotoMark;
    if (current.part === 'body') next = moveMark(start, dx, dy);
    else if (start.kind === 'arrow') {
      // The end of the arrow: its direction and length; the tip stays on the defect.
      next = {
        ...start,
        tailX: Math.min(1, Math.max(0, start.tailX + dx)),
        tailY: Math.min(1, Math.max(0, start.tailY + dy)),
      };
    } else {
      // The edge of the circle: its size.
      const px = (event.clientX - box.left) / box.width;
      const py = (event.clientY - box.top) / box.height;
      const short = Math.min(preview.width, preview.height);
      const distance = Math.hypot((px - start.x) * preview.width, (py - start.y) * preview.height);
      next = { ...start, r: Math.min(0.6, Math.max(0.03, distance / short)) };
    }
    setMarks((list) => list.map((m, i) => (i === current.index ? next : m)));
  };
  const endMark = () => {
    markDrag.current = null;
  };
  const markPointer = {
    onPointerMove: moveMarkPointer,
    onPointerUp: endMark,
    onPointerCancel: endMark,
  };

  const start = (handle: CropHandle) => (event: PointerEvent<HTMLElement>) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { handle, x: event.clientX, y: event.clientY, start: crop };
  };
  const move = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current;
    const box = frame.current?.getBoundingClientRect();
    if (!current || !box) return;
    setCrop(
      dragCrop(
        current.start,
        current.handle,
        (event.clientX - current.x) / box.width,
        (event.clientY - current.y) / box.height,
      ),
    );
  };
  const end = () => {
    drag.current = null;
  };
  const pointer = { onPointerMove: move, onPointerUp: end, onPointerCancel: end };

  // The photo fitted into the free space above the buttons.
  const fit =
    preview && area.width > 0 && area.height > 0
      ? Math.min(area.width / preview.width, area.height / preview.height)
      : 0;

  if (failed) {
    // An unreadable photo cannot be edited, but it can still be saved as it is.
    return (
      <Stack>
        <Text>Fotku nelze upravit v tomto prohlížeči.</Text>
        <Group grow>
          <Button variant="default" size="lg" onClick={() => onDone(null)}>
            Zahodit
          </Button>
          <Button size="lg" onClick={() => onDone({ rotation: 0, crop: FULL_CROP })}>
            Uložit bez úprav
          </Button>
        </Group>
      </Stack>
    );
  }

  return (
    <Stack gap="sm" h="calc(100dvh - 80px)">
      <Center ref={area.ref} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {preview?.rotation === rotation && fit > 0 ? (
          <Box
            ref={frame}
            pos="relative"
            w={preview.width * fit}
            h={preview.height * fit}
            style={{ lineHeight: 0, overflow: 'hidden', touchAction: 'none', userSelect: 'none' }}
          >
            <img
              src={preview.url}
              alt="Upravovaná fotka"
              data-rotation={rotation}
              draggable={false}
              style={{ display: 'block', width: '100%', height: '100%' }}
            />
            <Box
              data-testid="crop"
              onPointerDown={start('move')}
              {...pointer}
              style={{
                position: 'absolute',
                left: `${crop.x * 100}%`,
                top: `${crop.y * 100}%`,
                width: `${crop.w * 100}%`,
                height: `${crop.h * 100}%`,
                border: '2px solid white',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
                cursor: 'move',
              }}
            >
              {HANDLES.map((handle) => (
                <Box
                  key={handle}
                  aria-label={`Roh výřezu ${handle}`}
                  onPointerDown={start(handle)}
                  {...pointer}
                  style={{
                    position: 'absolute',
                    width: HANDLE_SIZE,
                    height: HANDLE_SIZE,
                    // Inside the corner: never cut off by the edge of the photo.
                    [handle.startsWith('n') ? 'top' : 'bottom']: -2,
                    [handle.endsWith('w') ? 'left' : 'right']: -2,
                    cursor: handle === 'nw' || handle === 'se' ? 'nwse-resize' : 'nesw-resize',
                  }}
                >
                  <Box
                    style={{
                      position: 'absolute',
                      width: 22,
                      height: 22,
                      [handle.startsWith('n') ? 'top' : 'bottom']: 0,
                      [handle.endsWith('w') ? 'left' : 'right']: 0,
                      [handle.startsWith('n') ? 'borderTop' : 'borderBottom']: '5px solid white',
                      [handle.endsWith('w') ? 'borderLeft' : 'borderRight']: '5px solid white',
                      filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.9))',
                    }}
                  />
                </Box>
              ))}
            </Box>
            <svg
              data-testid="marks"
              viewBox={`0 0 ${preview.width} ${preview.height}`}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                overflow: 'visible',
              }}
            >
              {marks.map((mark, index) => {
                const shape = markGeometry(mark, preview.width, preview.height);
                const handle = HANDLE_SIZE / 2 / fit;
                const end =
                  mark.kind === 'arrow'
                    ? { x: mark.tailX * preview.width, y: mark.tailY * preview.height }
                    : shape.circle
                      ? { x: shape.circle.cx + shape.circle.r, y: shape.circle.cy }
                      : null;
                const drawn = (color: string, width: number, events?: boolean) => (
                  <g
                    stroke={color}
                    strokeWidth={width}
                    strokeLinecap="round"
                    fill="none"
                    style={{ pointerEvents: events ? 'stroke' : 'none', cursor: 'move' }}
                    {...(events ? { onPointerDown: startMark(index, 'body'), ...markPointer } : {})}
                  >
                    {shape.circle && (
                      <circle cx={shape.circle.cx} cy={shape.circle.cy} r={shape.circle.r} />
                    )}
                    {shape.lines.map(([x1, y1, x2, y2], i) => (
                      <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
                    ))}
                  </g>
                );
                return (
                  <g key={index} data-testid={`mark-${mark.kind}`}>
                    {drawn('rgba(255,255,255,0.85)', shape.line * 1.8)}
                    {drawn(MARK_COLOR, shape.line)}
                    {/* Wide invisible stroke: easy to grab with a finger. */}
                    {drawn('transparent', Math.max(shape.line * 6, handle * 1.2), true)}
                    {selected === index && end && (
                      <circle
                        aria-label={mark.kind === 'arrow' ? 'Konec šipky' : 'Okraj kolečka'}
                        cx={end.x}
                        cy={end.y}
                        r={handle * 0.6}
                        fill="white"
                        stroke={MARK_COLOR}
                        strokeWidth={shape.line * 0.6}
                        style={{ pointerEvents: 'all', cursor: 'grab' }}
                        onPointerDown={startMark(index, 'end')}
                        {...markPointer}
                      />
                    )}
                  </g>
                );
              })}
            </svg>
          </Box>
        ) : (
          <Loader />
        )}
      </Center>
      <Text size="xs" c="dimmed" ta="center">
        Výřez: táhněte za rohy, posunete ho tažením uprostřed. Značku posunete tažením, bílým bodem
        změníte směr šipky nebo velikost kolečka.
      </Text>
      <Group grow gap="xs">
        <Button
          variant="light"
          color="red"
          size="md"
          px="xs"
          leftSection={<IconArrowUpRight size={20} />}
          disabled={preview?.rotation !== rotation}
          onClick={() => addMark('arrow')}
        >
          Šipka
        </Button>
        <Button
          variant="light"
          color="red"
          size="md"
          px="xs"
          leftSection={<IconCircle size={20} />}
          disabled={preview?.rotation !== rotation}
          onClick={() => addMark('circle')}
        >
          Kolečko
        </Button>
        <Button
          variant="default"
          size="md"
          px="xs"
          leftSection={<IconTrash size={20} />}
          disabled={selected === null}
          onClick={() => {
            setMarks((list) => list.filter((_, i) => i !== selected));
            setSelected(null);
          }}
        >
          Smazat značku
        </Button>
      </Group>
      <Group grow gap="xs">
        <Button
          variant="default"
          size="md"
          px="xs"
          leftSection={<IconRotate2 size={20} />}
          onClick={() => rotate(false)}
        >
          Doleva
        </Button>
        <Button
          variant="default"
          size="md"
          px="xs"
          leftSection={<IconRotateClockwise2 size={20} />}
          onClick={() => rotate(true)}
        >
          Doprava
        </Button>
        <Button
          variant="default"
          size="md"
          px="xs"
          leftSection={<IconMaximize size={20} />}
          disabled={isFullCrop(crop)}
          onClick={() => setCrop(FULL_CROP)}
        >
          Celá
        </Button>
      </Group>
      <Group grow gap="xs">
        <Button variant="default" size="lg" color="red" onClick={() => onDone(null)}>
          Zahodit
        </Button>
        <Button
          size="lg"
          disabled={preview?.rotation !== rotation}
          onClick={() => onDone({ rotation, crop, ...(marks.length ? { marks } : {}) })}
        >
          Uložit fotku
        </Button>
      </Group>
    </Stack>
  );
}
