<script setup lang="ts">
import { watch, onMounted, onBeforeUnmount } from 'vue'
import { cn } from '@/lib/utils'
const props = defineProps<{ open: boolean; title?: string; description?: string; class?: string }>()
const emit = defineEmits<{ close: [] }>()
const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && props.open) emit('close') }
watch(() => props.open, (v) => { document.body.style.overflow = v ? 'hidden' : '' })
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' })
</script>
<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
        <div class="absolute inset-0 bg-black/55 backdrop-blur-sm" @click="emit('close')" />
        <div :class="cn('relative z-10 w-full max-w-lg max-h-[85vh] overflow-auto rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-surface)] p-6 shadow-xl text-[var(--wc-fg)]', props.class)">
          <button type="button" class="absolute right-3 top-3 rounded-md p-1 text-[var(--wc-muted)] hover:bg-[var(--wc-surface-2)]" aria-label="Close" @click="emit('close')">×</button>
          <div v-if="title" class="mb-1 text-lg font-semibold tracking-tight">{{ title }}</div>
          <p v-if="description" class="mb-4 text-sm text-[var(--wc-muted)]">{{ description }}</p>
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
<style scoped>
.dialog-enter-active,.dialog-leave-active{transition:opacity .15s ease}
.dialog-enter-active>div:last-child,.dialog-leave-active>div:last-child{transition:transform .15s ease,opacity .15s ease}
.dialog-enter-from,.dialog-leave-to{opacity:0}
.dialog-enter-from>div:last-child,.dialog-leave-to>div:last-child{transform:translateY(8px) scale(.98);opacity:0}
</style>
