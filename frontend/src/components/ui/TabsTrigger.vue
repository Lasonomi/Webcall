<script setup lang="ts">
import { inject, computed, type ComputedRef } from 'vue'
import { cn } from '@/lib/utils'
const props = defineProps<{ value: string; class?: string }>()
const tabs = inject<{ value: ComputedRef<string>; set: (v: string) => void }>('tabs')!
const active = computed(() => tabs.value.value === props.value)
</script>
<template>
  <button
    type="button"
    role="tab"
    :aria-selected="active"
    :class="cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wc-maroon)]',
      active ? 'bg-[var(--wc-surface)] text-[var(--wc-fg)] shadow-sm' : 'text-[var(--wc-muted)] hover:text-[var(--wc-fg)]',
      props.class
    )"
    @click="tabs.set(value)"
  >
    <slot />
  </button>
</template>
