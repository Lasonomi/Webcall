<script setup lang="ts">
import { onMounted } from 'vue'
import { useThemeStore } from '@/stores/theme.store'

const theme = useThemeStore()
onMounted(() => theme.init())
</script>

<template>
  <RouterView />
</template>
