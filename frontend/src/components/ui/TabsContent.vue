<script setup lang="ts">
import { inject, computed, type ComputedRef } from 'vue'
import { cn } from '@/lib/utils'
const props = defineProps<{ value: string; class?: string }>()
const tabs = inject<{ value: ComputedRef<string>; set: (v: string) => void }>('tabs')!
const show = computed(() => tabs.value.value === props.value)
</script>
<template>
  <div v-if="show" role="tabpanel" :class="cn('mt-3 focus-visible:outline-none', props.class)">
    <slot />
  </div>
</template>
