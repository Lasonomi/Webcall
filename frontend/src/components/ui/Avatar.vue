<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'
const props = withDefaults(
  defineProps<{ src?: string; name?: string; size?: 'sm' | 'md' | 'lg' | 'xl'; class?: string }>(),
  { src: '', name: '?', size: 'md' }
)
const sizeClass = computed(() => {
  switch (props.size) {
    case 'sm': return 'h-7 w-7 text-[10px] rounded-lg'
    case 'lg': return 'h-10 w-10 text-sm rounded-xl'
    case 'xl': return 'h-16 w-16 text-lg rounded-2xl'
    default: return 'h-9 w-9 text-xs rounded-xl'
  }
})
const initials = computed(() => {
  const n = (props.name || '?').trim()
  return n.split(/\s+/).map((s) => s[0]).join('').slice(0, 2).toUpperCase()
})
</script>
<template>
  <span
    :class="cn('inline-flex shrink-0 items-center justify-center overflow-hidden border border-[var(--wc-border)] bg-[var(--wc-surface-2)] text-[var(--wc-gold)] font-semibold', sizeClass, props.class)"
    :style="src ? { backgroundImage: `url(${src})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined"
  >
    <span v-if="!src">{{ initials }}</span>
  </span>
</template>
