<script setup lang="ts">
import { cn } from '@/lib/utils'
const props = defineProps<{ class?: string; orientation?: 'horizontal' | 'vertical' }>()
</script>
<template>
  <div role="separator" :class="cn('shrink-0 bg-[var(--wc-border)]', orientation==='vertical'?'h-full w-px':'h-px w-full', props.class)" />
</template>
