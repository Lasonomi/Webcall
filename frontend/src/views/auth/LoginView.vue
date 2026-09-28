<script setup lang="ts">
import AuthView from '@/components/AuthView.vue'
import { useRouter } from 'vue-router'

const router = useRouter()

function onAuthenticated() {
  router.replace({ name: 'app' })
}
</script>

<template>
  <AuthView @authenticated="onAuthenticated" />
</template>
