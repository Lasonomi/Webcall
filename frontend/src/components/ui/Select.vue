<script setup lang="ts">
import { cn } from '@/lib/utils'
const props = defineProps<{
  modelValue?: string
  disabled?: boolean
  class?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()
</script>
<template>
  <select
    :value="modelValue"
    :disabled="disabled"
    :class="cn('flex h-9 w-full rounded-lg border border-[var(--wc-border)] bg-[var(--wc-bg)] px-3 py-1 text-sm text-[var(--wc-fg)] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wc-maroon)] disabled:cursor-not-allowed disabled:opacity-50', props.class)"
    @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
  >
    <slot />
  </select>
</template>
