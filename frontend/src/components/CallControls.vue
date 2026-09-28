<template>
  <section class="controls" v-if="hasStream">
    <button @click="$emit('toggle-mute')" class="btn control" :class="{ active: isMuted }">
      {{ isMuted ? 'Unmute' : 'Mute' }}
    </button>
    <button @click="$emit('toggle-camera')" class="btn control" :class="{ active: !isCameraOn }">
      {{ isCameraOn ? 'Cam Off' : 'Cam On' }}
    </button>
    <button v-if="isInCall" @click="$emit('end')" class="btn hangup">
      End Call
    </button>
  </section>
</template>

<script setup>
defineProps({
  hasStream: Boolean,
  isMuted: Boolean,
  isCameraOn: Boolean,
  isInCall: Boolean
})
defineEmits(['toggle-mute', 'toggle-camera', 'end'])
</script>

<style scoped>
.controls {
  display: flex;
  justify-content: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 32px;
}
</style>