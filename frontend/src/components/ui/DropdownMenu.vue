<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { cn } from '@/lib/utils'
const open = ref(false)
const root = ref<HTMLElement | null>(null)
const props = defineProps<{ class?: string }>()
const close = () => { open.value = false }
const onDoc = (e: MouseEvent) => {
  if (root.value && !root.value.contains(e.target as Node)) close()
}
onMounted(() => document.addEventListener('click', onDoc))
onBeforeUnmount(() => document.removeEventListener('click', onDoc))
defineExpose({ close })
</script>
<template>
  <div ref="root" :class="cn('relative inline-flex', props.class)">
    <div @click.stop="open = !open"><slot name="trigger" /></div>
    <div
      v-if="open"
      class="absolute right-0 top-full z-50 mt-1 min-w-[10rem] overflow-hidden rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] p-1 text-[var(--wc-fg)] shadow-lg"
      @click="close"
    >
      <slot />
    </div>
  </div>
</template>
