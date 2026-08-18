import React from 'react'
import { Box, Text } from '../../ui.js'
import { t } from '../../i18n.js'
import { StreamingMarkdown } from '../StreamingMarkdown.js'
import { formatDuration } from '../../cc/format.js'

type Props = {
  thinking: string
  /** Adds the top margin between messages (CC: addMargin). */
  addMargin: boolean
  /** True when Ctrl+O transcript/verbose mode is on — show the full text. */
  verbose: boolean
  /** Streaming compact mode (thinkingFold=preview): a 2-3 line live ticker
   *  of the model's latest reasoning lines instead of the full block —
   *  kimicode-style. Each source line truncates to the width so the block
   *  is at most 3 screen rows tall. */
  preview?: boolean
  /** Thinking wall-clock duration once the reasoning block settled (ms). */
  durationMs?: number
  /** Message-selection mode highlight. */
  isSelected?: boolean
  onClick?(): void
}

/**
 * Thinking block: folded `∴ Thinking (ctrl+o to expand)`, expanded shows the
 * full reasoning text indented under `∴ Thinking…`, mirroring Claude Code's
 * `messages/AssistantThinkingMessage.tsx`. When the channel records the
 * reasoning duration, the label carries it (`∴ Thinking · 12s …`) — dsh-tui's
 * take on making thinking time visible in the transcript.
 */
export function AssistantThinkingMessage({
  thinking,
  addMargin,
  verbose,
  preview = false,
  durationMs,
  isSelected = false,
  onClick,
}: Props): React.ReactNode {
  if (!thinking) return null

  const duration =
    durationMs !== undefined && durationMs >= 1000
      ? ` · ${formatDuration(durationMs)}`
      : ''

  if (preview) {
    // Live ticker: the model's last few reasoning lines, dimmed, each
    // truncated to the width — a bounded 2-3 row block that follows the
    // stream. The folded summary takes over when the step settles.
    const lines = thinking.split('\n')
    const visible = lines.slice(-3)
    const clipped = lines.length > visible.length
    return (
      <Box
        flexDirection="column"
        marginTop={addMargin ? 1 : 0}
        backgroundColor={isSelected ? 'messageActionsBackground' : undefined}
        onClick={onClick}
      >
        <Text dimColor italic>
          ∴ {t('thinking-label')}{duration}…
        </Text>
        <Box paddingLeft={2}>
          <Text dimColor italic wrap="truncate">
            {clipped ? `…${visible.join('\n')}` : visible.join('\n')}
          </Text>
        </Box>
      </Box>
    )
  }

  if (!verbose) {
    return (
      <Box
        marginTop={addMargin ? 1 : 0}
        backgroundColor={isSelected ? 'messageActionsBackground' : undefined}
        onClick={onClick}
      >
        <Text dimColor italic>
          ∴ {t('thinking-label')}{duration} {t('hint-expand-ctrl-o')}
        </Text>
      </Box>
    )
  }

  return (
    <Box
      flexDirection="column"
      gap={1}
      marginTop={addMargin ? 1 : 0}
      width="100%"
      backgroundColor={isSelected ? 'messageActionsBackground' : undefined}
      onClick={onClick}
    >
      <Text dimColor italic>
        ∴ {t('thinking-label')}{duration}…
      </Text>
      <Box paddingLeft={2}>
        {/* StreamingMarkdown: the live thinking text grows per token — the
          incremental stable-prefix + tail budget keeps the per-frame layout
          cost at O(new content) instead of re-laying out the whole block. */}
        <StreamingMarkdown dimColor>{thinking}</StreamingMarkdown>
      </Box>
    </Box>
  )
}
