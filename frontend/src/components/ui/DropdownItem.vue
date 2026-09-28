<script setup lang="ts">
import { cn } from '@/lib/utils'
const props = defineProps<{ class?: string; destructive?: boolean; disabled?: boolean }>()
const emit = defineEmits<{ click: [MouseEvent] }>()
</script>
<template>
  <button
    type="button"
    :disabled="disabled"
    :class="cn(
      'relative flex w-full cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-sm outline-none transition-colors',
      destructive ? 'text-red-400 hover:bg-red-500/10' : 'hover:bg-[var(--wc-surface-2)]',
      disabled && 'pointer-events-none opacity-50',
      props.class
    )"
    @click="emit('click', $event)"
  >
    <slot />
  </button>
</template>
