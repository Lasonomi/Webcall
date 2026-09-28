<template>
  <section class="card info-card">
    <div class="id-box">
      <span class="label">Your ID</span>
      <div class="id-value">{{ myId || 'Connecting...' }}</div>
    </div>

    <div v-if="!isInCall" class="join-box">
      <input 
        :value="remoteId"
        @input="$emit('update:remoteId', $event.target.value)"
        placeholder="Enter partner's ID"
        class="input"
      />
      <button @click="$emit('start')" :disabled="!myId || !remoteId" class="btn primary">
        Start Call
      </button>
    </div>

    <div v-else class="status-box">
      <span class="status-dot"></span>
      <span>In Call</span>
    </div>
  </section>
</template>

<script setup>
defineProps({
  myId: String,
  remoteId: String,
  isInCall: Boolean
})
defineEmits(['update:remoteId', 'start'])
</script>

<style scoped>
.info-card {
  margin-bottom: 28px;
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: center;
  justify-content: space-between;
}
.id-box .label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--gold-light);
  opacity: 0.7;
}
.id-value {
  font-family: 'Cinzel', serif;
  font-size: 1.25rem;
  color: var(--gold);
  margin-top: 4px;
  word-break: break-all;
}
.join-box {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.status-box {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: 'Playfair Display', serif;
  color: var(--gold);
  font-size: 1.1rem;
}
.status-dot {
  width: 10px;
  height: 10px;
  background: #22c55e;
  border-radius: 50%;
  box-shadow: 0 0 10px #22c55e;
  animation: pulse 1.8s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.85); }
}
</style>