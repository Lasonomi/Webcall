<script setup lang="ts">
import { cn } from '@/lib/utils'
const props = defineProps<{ class?: string }>()
</script>
<template>
  <div :class="cn('rounded-xl border border-[var(--wc-border)] bg-[var(--wc-surface)] text-[var(--wc-fg)] shadow-sm', props.class)">
    <slot />
  </div>
</template>
