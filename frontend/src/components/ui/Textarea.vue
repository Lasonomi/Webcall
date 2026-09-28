<script setup lang="ts">
import { cn } from '@/lib/utils'
const props = defineProps<{
  modelValue?: string
  placeholder?: string
  disabled?: boolean
  rows?: number
  class?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()
</script>
<template>
  <textarea
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :rows="rows || 3"
    :class="cn('flex min-h-[80px] w-full rounded-lg border border-[var(--wc-border)] bg-[var(--wc-bg)] px-3 py-2 text-sm text-[var(--wc-fg)] shadow-sm placeholder:text-[var(--wc-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wc-maroon)] disabled:cursor-not-allowed disabled:opacity-50 resize-y', props.class)"
    @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
</template>
