<script setup lang="ts">
import { provide, computed } from 'vue'
import { cn } from '@/lib/utils'
const props = defineProps<{ modelValue: string; class?: string }>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()
provide('tabs', {
  value: computed(() => props.modelValue),
  set: (v: string) => emit('update:modelValue', v),
})
</script>
<template>
  <div :class="cn('w-full', props.class)"><slot /></div>
</template>
