import React, { useState } from 'react'
import { Box, NoSelect, Text } from '../../ui.js'
import { BLACK_CIRCLE } from '../../cc/figures.js'
import { Markdown } from '../Markdown.js'
import type { ClickEvent } from '../../ink/events/click-event.js'

type Props = {
  text: string
  /** Adds the top margin between messages (CC: addMargin). */
  addMargin: boolean
  /** Message-selection mode highlight. */
  isSelected?: boolean
  /** Row expanded on its own (persistent hover-grey background, CC). */
  isExpanded?: boolean
  onClick?(event: ClickEvent): void
}

/**
 * Assistant text message:  bullet + markdown body (mirroring Claude Code's  default branch).
 */
export function AssistantTextMessage({
  text,
  addMargin,
  isSelected = false,
  isExpanded = false,
  onClick,
}: Props): React.ReactNode {
  // Hover highlight only on clickable rows — the mouse affordance over the
  // full-width row (the palette matches isExpanded's persistent tint).
  const [hovered, setHovered] = useState(false)
  const showHoverTint = hovered && !isSelected && !isExpanded
  return (
    <Box
      alignItems="flex-start"
      flexDirection="row"
      justifyContent="space-between"
      marginTop={addMargin ? 1 : 0}
      width="100%"
      backgroundColor={
        isSelected
          ? 'messageActionsBackground'
          : isExpanded || showHoverTint
            ? 'userMessageBackgroundHover'
            : undefined
      }
      onClick={onClick}
      onMouseEnter={onClick !== undefined ? () => setHovered(true) : undefined}
      onMouseLeave={onClick !== undefined ? () => setHovered(false) : undefined}
    >
      <Box flexDirection="row">
        <NoSelect fromLeftEdge minWidth={2}>
          <Text color={isSelected ? 'suggestion' : 'text'}>{BLACK_CIRCLE}</Text>
        </NoSelect>
        <Box flexDirection="column">
          <Markdown>{text}</Markdown>
        </Box>
      </Box>
    </Box>
  )
}
