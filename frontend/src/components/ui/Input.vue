<script setup lang="ts">
import { cn } from '@/lib/utils'
const props = defineProps<{
  modelValue?: string
  type?: string
  placeholder?: string
  disabled?: boolean
  class?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()
</script>
<template>
  <input
    :type="type || 'text'"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :class="cn('flex h-9 w-full rounded-lg border border-[var(--wc-border)] bg-[var(--wc-bg)] px-3 py-1 text-sm text-[var(--wc-fg)] shadow-sm transition-colors placeholder:text-[var(--wc-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wc-maroon)] disabled:cursor-not-allowed disabled:opacity-50', props.class)"
    @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>
