<script setup lang="ts">
defineProps<{
  servers: Array<{ id: string; name: string; icon_url?: string }>
  activeServerId?: string | null
}>()
const emit = defineEmits<{
  home: []
  select: [id: string]
  create: []
  join: []
}>()

function initials(name: string) {
  return (name || '?')
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
</script>

<template>
  <nav class="server-rail">
    <button
      class="server-icon home-icon"
      :class="{ active: !activeServerId }"
      title="Home / Friends"
      @click="emit('home')"
    >
      <span>⌂</span>
    </button>
    <div class="rail-divider" />
    <button
      v-for="srv in servers"
      :key="srv.id"
      class="server-icon"
      :class="{ active: activeServerId === srv.id }"
      :title="srv.name"
      @click="emit('select', srv.id)"
    >
      <img v-if="srv.icon_url" :src="srv.icon_url" :alt="srv.name" />
      <span v-else>{{ initials(srv.name) }}</span>
    </button>
    <button class="server-icon add-icon" title="Create Server" @click="emit('create')">＋</button>
    <button class="server-icon join-icon" title="Join Server" @click="emit('join')">⧉</button>
  </nav>
</template>
