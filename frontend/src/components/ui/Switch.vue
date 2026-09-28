<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'
const props = defineProps<{ modelValue?: boolean; disabled?: boolean; class?: string }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()
const on = computed(() => !!props.modelValue)
</script>
<template>
  <button
    type="button"
    role="switch"
    :aria-checked="on"
    :disabled="disabled"
    :class="cn(
      'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wc-maroon)] disabled:cursor-not-allowed disabled:opacity-50',
      on ? 'bg-[var(--wc-maroon)] border-[var(--wc-maroon)]' : 'bg-[var(--wc-surface-2)] border-[var(--wc-border)]',
      props.class
    )"
    @click="emit('update:modelValue', !on)"
  >
    <span
      :class="cn(
        'pointer-events-none block h-4 w-4 rounded-full bg-white shadow transition-transform',
        on ? 'translate-x-4' : 'translate-x-0.5'
      )"
    />
  </button>
</template>
