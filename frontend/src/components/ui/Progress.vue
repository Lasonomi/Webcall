<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'
const props = withDefaults(defineProps<{ value?: number; class?: string }>(), { value: 0 })
const pct = computed(() => Math.max(0, Math.min(100, props.value || 0)))
</script>
<template>
  <div :class="cn('relative h-2 w-full overflow-hidden rounded-full bg-[var(--wc-surface-2)]', props.class)">
    <div
      class="h-full bg-[var(--wc-maroon)] transition-all duration-300"
      :style="{ width: pct + '%' }"
    />
  </div>
</template>
