<template>
  <section class="card chat-card" v-if="isInCall">
    <div class="chat-header">Private Chat</div>
    
    <div class="messages" ref="messagesContainer">
      <div 
        v-for="(msg, i) in messages" 
        :key="i" 
        class="message"
        :class="{ mine: msg.isMine }"
      >
        <span class="msg-text">{{ msg.text }}</span>
        <span class="msg-time">{{ msg.time }}</span>
      </div>
      <div v-if="messages.length === 0" class="empty-chat">
        No messages yet
      </div>
    </div>

    <div class="chat-input">
      <input 
        v-model="input"
        @keyup.enter="send"
        placeholder="Type a message..."
        class="input"
      />
      <button @click="send" class="btn primary small">Send</button>
    </div>
  </section>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  isInCall: Boolean,
  messages: Array
})
const emit = defineEmits(['send'])

const input = ref('')
const messagesContainer = ref(null)

const send = () => {
  const text = input.value.trim()
  if (!text) return
  emit('send', text)
  input.value = ''
}

watch(() => props.messages.length, async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
})
</script>

<style scoped>
.chat-card {
  max-width: 600px;
  margin: 0 auto;
}
.chat-header {
  font-family: 'Cinzel', serif;
  font-size: 1.1rem;
  color: var(--gold);
  letter-spacing: 2px;
  margin-bottom: 16px;
  text-align: center;
}
.messages {
  height: 220px;
  overflow-y: auto;
  padding: 12px;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 12px;
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.message {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(107, 26, 26, 0.6);
  align-self: flex-start;
}
.message.mine {
  background: linear-gradient(135deg, rgba(212, 175, 55, 0.25), rgba(184, 134, 11, 0.2));
  border: 1px solid rgba(212, 175, 55, 0.3);
  align-self: flex-end;
}
.msg-text {
  display: block;
  color: var(--cream);
  font-size: 0.95rem;
  line-height: 1.4;
}
.msg-time {
  display: block;
  font-size: 0.7rem;
  color: rgba(245, 230, 200, 0.5);
  margin-top: 4px;
  text-align: right;
}
.empty-chat {
  text-align: center;
  color: rgba(245, 230, 200, 0.35);
  font-style: italic;
  margin-top: 70px;
}
.chat-input {
  display: flex;
  gap: 10px;
}
.chat-input .input {
  flex: 1;
  min-width: 0;
}
.messages::-webkit-scrollbar {
  width: 6px;
}
.messages::-webkit-scrollbar-track {
  background: transparent;
}
.messages::-webkit-scrollbar-thumb {
  background: rgba(212, 175, 55, 0.3);
  border-radius: 3px;
}
</style>