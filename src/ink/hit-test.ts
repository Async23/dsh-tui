import type { DOMElement } from './dom.js'
import { ClickEvent } from './events/click-event.js'
import type { EventHandlerProps } from './events/event-handlers.js'
import { PointerEvent } from './events/pointer-event.js'
import { WheelEvent } from './events/wheel-event.js'
import { logError } from '../utils/log.js'
import { nodeCache } from './node-cache.js'
import { dispatcher } from './reconciler.js'

/**
 * Find the deepest DOM element whose rendered rect contains (col, row).
 *
 * Uses the nodeCache populated by renderNodeToOutput — rects are in screen
 * coordinates with all offsets (including scrollTop translation) already
 * applied. Children are traversed in reverse so later siblings (painted on
 * top) win. Nodes not in nodeCache (not rendered this frame, or lacking a
 * yogaNode) are skipped along with their subtrees.
 *
 * Returns the hit node even if it has no onClick — dispatchClick walks up
 * via parentNode to find handlers.
 * @param node - the subtree root to test.
 * @param col - the screen column to test.
 * @param row - the screen row to test.
 * @returns the deepest element whose rect contains (col, row), or null.
 */
export function hitTest(
  node: DOMElement,
  col: number,
  row: number,
): DOMElement | null {
  const rect = nodeCache.get(node)
  if (!rect) return null
  if (
    col < rect.x ||
    col >= rect.x + rect.width ||
    row < rect.y ||
    row >= rect.y + rect.height
  ) {
    return null
  }
  // Later siblings paint on top; reversed traversal returns topmost hit.
  for (let i = node.childNodes.length - 1; i >= 0; i--) {
    const child = node.childNodes[i]!
    if (child.nodeName === '#text') continue
    const hit = hitTest(child, col, row)
    if (hit) return hit
  }
  return node
}

/**
 * Hit-test the root at (col, row) and bubble a ClickEvent from the deepest
 * containing node up through parentNode. Only nodes with an onClick handler
 * fire. Stops when a handler calls stopImmediatePropagation(). Returns
 * true if at least one onClick handler fired.
 *
 * Each handler call is isolated: a throwing handler is logged and the
 * bubbling continues, so one broken onClick cannot swallow the click from
 * its ancestors or the rest of the input batch.
 *
 * @param root - the tree root to hit-test.
 * @param col - the screen column of the click.
 * @param row - the screen row of the click.
 * @param cellIsBlank - whether the clicked cell is blank, reported on the event.
 * @param button - raw SGR release byte (carries shift/alt/ctrl modifier bits).
 * @returns true when at least one onClick handler fired.
 */
export function dispatchClick(
  root: DOMElement,
  col: number,
  row: number,
  cellIsBlank = false,
  button = 0,
): boolean {
  let target: DOMElement | undefined = hitTest(root, col, row) ?? undefined
  if (!target) return false

  // Click-to-focus: find the closest focusable ancestor and focus it.
  // root is always ink-root, which owns the FocusManager.
  if (root.focusManager) {
    let focusTarget: DOMElement | undefined = target
    while (focusTarget) {
      if (typeof focusTarget.attributes['tabIndex'] === 'number') {
        root.focusManager.handleClickFocus(focusTarget)
        break
      }
      focusTarget = focusTarget.parentNode
    }
  }
  const event = new ClickEvent(col, row, cellIsBlank, { button })
  let handled = false
  while (target) {
    const handler = target._eventHandlers?.onClick as
      | ((event: ClickEvent) => void)
      | undefined
    if (handler) {
      handled = true
      const rect = nodeCache.get(target)
      if (rect) {
        event.localCol = col - rect.x
        event.localRow = row - rect.y
      } else {
        event.localCol = 0
        event.localRow = 0
      }
      try {
        handler(event)
      } catch (error) {
        logError(error)
      }
      if (event.didStopImmediatePropagation()) return true
    }
    target = target.parentNode
  }
  return handled
}

/**
 * Route a wheel event to the ScrollBox (or any onWheel handler) under the
 * pointer. Dispatches through the shared Dispatcher at continuous priority
 * so the event bubbles from the deepest hit node and React schedules any
 * state updates at the right lane.
 *
 * @param root - the tree root to hit-test.
 * @param col - the screen column of the wheel event.
 * @param row - the screen row of the wheel event.
 * @param deltaY - rows to scroll (positive = scroll down).
 * @param deltaX - columns to scroll (positive = right; informational).
 * @param button - raw SGR byte (carries modifier bits).
 * @returns true when an onWheel handler existed under the pointer.
 */
export function dispatchWheel(
  root: DOMElement,
  col: number,
  row: number,
  deltaY: number,
  deltaX = 0,
  button = 0,
): boolean {
  const target = hitTest(root, col, row)
  if (!target) return false
  // Does any ancestor (target inclusive) carry an onWheel handler?
  let node: DOMElement | undefined = target
  let hasHandler = false
  while (node && !hasHandler) {
    hasHandler = Boolean(node._eventHandlers?.onWheel)
    node = node.parentNode
  }
  if (!hasHandler) return false
  const event = new WheelEvent(col, row, deltaY, deltaX, { button })
  dispatcher.dispatchContinuous(target, event)
  return true
}

/**
 * Fire onMouseEnter/onMouseLeave as the pointer moves. Like DOM
 * mouseenter/mouseleave: does NOT bubble — moving between children does
 * not re-fire on the parent. Walks up from the hit node collecting every
 * ancestor with a hover handler; diffs against the previous hovered set;
 * fires leave on the nodes exited, enter on the nodes entered.
 *
 * Handlers receive a PointerEvent ('hover') with the pointer position;
 * existing `() => void` handlers simply ignore the argument. Each call is
 * isolated so one throwing handler cannot break the rest of the diff.
 *
 * Mutates `hovered` in place so the caller (App instance) can hold it
 * across calls. Clears the set when the hit is null (cursor moved into a
 * non-rendered gap or off the root rect).
 * @param root - the tree root to hit-test.
 * @param col - the screen column of the pointer.
 * @param row - the screen row of the pointer.
 * @param hovered - the previously hovered element set; updated in place.
 */
export function dispatchHover(
  root: DOMElement,
  col: number,
  row: number,
  hovered: Set<DOMElement>,
): void {
  const next = new Set<DOMElement>()
  let node: DOMElement | undefined = hitTest(root, col, row) ?? undefined
  while (node) {
    const h = node._eventHandlers as EventHandlerProps | undefined
    if (h?.onMouseEnter || h?.onMouseLeave) next.add(node)
    node = node.parentNode
  }
  for (const old of hovered) {
    if (!next.has(old)) {
      hovered.delete(old)
      // Skip handlers on detached nodes (removed between mouse events)
      if (old.parentNode) {
        const handler = (old._eventHandlers as EventHandlerProps | undefined)
          ?.onMouseLeave
        if (handler) {
          try {
            handler(new PointerEvent('hover', col, row, { action: 'move' }))
          } catch (error) {
            logError(error)
          }
        }
      }
    }
  }
  for (const n of next) {
    if (!hovered.has(n)) {
      hovered.add(n)
      const handler = (n._eventHandlers as EventHandlerProps | undefined)
        ?.onMouseEnter
      if (handler) {
        try {
          handler(new PointerEvent('hover', col, row, { action: 'move' }))
        } catch (error) {
          logError(error)
        }
      }
    }
  }
}
