import React from 'react'
import { Box, Text, type ScrollBoxHandle } from '../ui.js'

export interface ScrollbarNode {
  /** Row id of the user message this node represents. */
  id: number
  /** Content-space top of the row's TEXT (header base + rows offset + the
   *  row's top margin), so a jump scrolls it to the viewport top. */
  top: number
}

/**
 * One-column minimap scrollbar for the fullscreen transcript, rendered as a
 * flex sibling of the ScrollBox:
 *
 *  - the thumb (█) shows the visible window over the whole content;
 *  - one node per user message (·): the node for the message the viewport
 *    is currently showing is highlighted (●, yellow) — the same anchor the
 *    sticky prompt header pins — so the bar tracks which turn the user is
 *    on, and the node "sticks out" for that message;
 *  - clicking a node jumps to that message (the row aligns with the
 *    viewport top); clicking the track scrolls that content position to
 *    the top; hovering a node brightens it.
 *
 * Renders nothing when there is nothing to scroll — inline (main-screen)
 * mode reports the viewport as the content height, so `content <= viewport`
 * there and the terminal's own scrollback handles navigation.
 */
export function TranscriptScrollbar({
  handle,
  nodes,
  anchorRowId,
}: {
  handle: ScrollBoxHandle | null
  nodes: ReadonlyArray<ScrollbarNode>
  anchorRowId: number | null
}): React.ReactNode {
  const [, setTick] = React.useState(0)
  React.useEffect(() => {
    if (!handle) return
    return handle.subscribe(() => setTick(t => t + 1))
  }, [handle])
  const [hoveredId, setHoveredId] = React.useState<number | null>(null)

  if (!handle) return null
  const scrollTop = handle.getScrollTop()
  const viewport = handle.getViewportHeight()
  const content = handle.getScrollHeight()
  if (viewport <= 0 || content <= viewport) return null

  // Thumb: the visible window mapped onto the track. Height proportional
  // to the visible fraction; top follows scrollTop over the scroll range.
  const thumbH = Math.max(1, Math.round((viewport * viewport) / content))
  const thumbTop = Math.round((scrollTop / Math.max(1, content - viewport)) * Math.max(0, viewport - thumbH))
  const thumbBottom = Math.min(viewport, thumbTop + thumbH)

  // Nodes: content scale over the whole track; each node lands on one
  // cell. If two user rows collapse onto the same cell, the first wins.
  const nodeAtRow = new Map<number, ScrollbarNode>()
  for (const node of nodes) {
    const y = Math.max(0, Math.min(viewport - 1, Math.round((node.top / content) * (viewport - 1))))
    if (!nodeAtRow.has(y)) nodeAtRow.set(y, node)
  }

  // Clicking the track maps the clicked row back to a scrollTop (thumb
  // scale inverse) and scrolls that content position to the viewport top.
  const trackScrollTop = (y: number): number => {
    if (y <= 0) return 0
    if (y >= viewport - 1) return Math.max(0, content - viewport)
    return Math.round((y / Math.max(1, viewport - thumbH)) * (content - viewport))
  }

  // Current message: the anchor reported by MessageList. While pinned to
  // the bottom (anchor null) the last node stands in — the tail IS the
  // latest turn, so its node stays highlighted there.
  const sticky = handle.isSticky()
  const highlightId =
    anchorRowId ?? (sticky && nodes.length > 0 ? nodes[nodes.length - 1]!.id : null)

  const cells: React.ReactNode[] = []
  for (let y = 0; y < viewport; y++) {
    const node = nodeAtRow.get(y)
    const inThumb = y >= thumbTop && y < thumbBottom
    let glyph: string
    let color: 'briefLabelYou' | 'text' | 'subtle' | undefined
    let onClick: (() => void) | undefined
    let onEnter: (() => void) | undefined
    let onLeave: (() => void) | undefined
    if (node) {
      const isAnchor = node.id === highlightId
      const hovered = hoveredId === node.id
      glyph = isAnchor || hovered ? '●' : '·'
      color = isAnchor ? 'briefLabelYou' : hovered ? 'text' : 'subtle'
      // Jump by CONTENT COORDINATE, not by element: the node's row is
      // usually unmounted (virtualization), and the element-based seek's
      // force-mount path unmounts the row again before the renderer's
      // deferred Yoga read — scrollToElement would silently no-op. The
      // reported top is the measured text position, exact to the pixel
      // (verified: equals the element's computed top + its margin).
      onClick = () => handle.scrollTo(node.top)
      onEnter = () => setHoveredId(node.id)
      onLeave = () => setHoveredId(null)
    } else {
      glyph = inThumb ? '█' : ' '
      if (inThumb) color = 'subtle'
      onClick = () => handle.scrollTo(trackScrollTop(y))
    }
    cells.push(
      <Box
        key={y}
        width={1}
        height={1}
        flexShrink={0}
        onClick={onClick}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        <Text color={color}>{glyph}</Text>
      </Box>,
    )
  }
  return (
    <Box flexDirection="column" flexShrink={0} width={1}>
      {cells}
    </Box>
  )
}
