<script setup lang="ts">
import { useRouter } from 'vue-router'
import Button from '@/components/ui/Button.vue'
const router = useRouter()
</script>
<template>
  <div class="min-h-screen flex flex-col items-center justify-center gap-4" style="background:var(--wc-bg);color:var(--wc-fg)">
    <h1 class="text-2xl font-semibold">Page not found</h1>
    <Button @click="router.push('/')">Go home</Button>
  </div>
</template>
