<template>
  <main class="auth-shell">
    <section class="auth-card">
      <div class="brand-mark">ÉC</div>
      <p class="eyebrow">PRIVATE COMMUNICATION</p>
      <h1>ÉLAN CALL</h1>
      <p class="intro">Meet, talk, and stay close — in a private space inspired by the familiar flow of Discord.</p>

      <div class="auth-tabs" role="tablist">
        <button :class="{ active: mode === 'login' }" @click="mode = 'login'">Sign in</button>
        <button :class="{ active: mode === 'register' }" @click="mode = 'register'">Create account</button>
      </div>

      <form @submit.prevent="submit" class="auth-form">
        <label v-if="mode === 'register'">Display name<input v-model.trim="displayName" autocomplete="name" placeholder="Your name" /></label>
        <label v-if="mode === 'register'">Username<input v-model.trim="username" autocomplete="username" placeholder="yourname" /></label>
        <label v-if="mode === 'register'">Email<input v-model.trim="email" type="email" autocomplete="email" placeholder="you@example.com" /></label>
        <label>{{ mode === 'login' ? 'Username or email' : 'Password' }}
          <input v-if="mode === 'login'" v-model.trim="login" autocomplete="username" placeholder="username or email" />
          <input v-else v-model="password" type="password" autocomplete="new-password" placeholder="Minimum 8 characters" />
        </label>
        <label v-if="mode === 'login'">Password<input v-model="password" type="password" autocomplete="current-password" placeholder="Your password" /></label>
        <label v-if="mode === 'register'">Confirm password<input v-model="confirmPassword" type="password" autocomplete="new-password" placeholder="Repeat password" /></label>

        <p v-if="localError" class="form-error">{{ localError }}</p>
        <p v-if="error" class="form-error">{{ error }}</p>
        <button class="submit-btn" :disabled="loading" type="submit">
          {{ loading ? 'Please wait…' : mode === 'login' ? 'Enter Élan' : 'Create account' }}
        </button>
      </form>

      <p class="secure-note">Your account is authenticated by the Go backend. Passwords are never stored in plain text.</p>
    </section>
  </main>
</template>

<script setup>
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'

const emit = defineEmits(['authenticated'])
const { login: signIn, register: signUp, loading, error } = useAuth()
const mode = ref('login')
const login = ref('')
const password = ref('')
const username = ref('')
const email = ref('')
const displayName = ref('')
const confirmPassword = ref('')
const localError = ref('')

const submit = async () => {
  localError.value = ''
  if (mode.value === 'login') {
    if (!login.value || !password.value) {
      localError.value = 'Isi username/email dan password terlebih dahulu.'
      return
    }
    if (await signIn(login.value, password.value)) emit("authenticated")
    return
  }

  if (!username.value || !email.value || !password.value) {
    localError.value = 'Username, email, dan password wajib diisi.'
    return
  }
  if (password.value.length < 8) {
    localError.value = 'Password minimal 8 karakter.'
    return
  }
  if (password.value !== confirmPassword.value) {
    localError.value = 'Konfirmasi password belum sama.'
    return
  }
  if (await signUp({
    username: username.value,
    email: email.value,
    password: password.value,
    display_name: displayName.value || username.value,
  })) emit("authenticated")
}
</script>

<style scoped>
.auth-shell{min-height:100vh;display:grid;place-items:center;padding:32px;background:radial-gradient(circle at 50% -10%,rgba(212,175,55,.12),transparent 42%),#210707}
.auth-card{width:min(480px,100%);padding:42px;border:1px solid rgba(212,175,55,.24);border-radius:28px;background:rgba(52,10,10,.86);box-shadow:0 28px 90px rgba(0,0,0,.46);backdrop-filter:blur(18px)}
.brand-mark{width:54px;height:54px;display:grid;place-items:center;border:1px solid rgba(212,175,55,.55);border-radius:16px;color:var(--gold);font-family:'Cinzel',serif;font-weight:700;letter-spacing:-2px}
.eyebrow{margin-top:22px;color:rgba(240,215,140,.66);font-size:11px;letter-spacing:3px}.auth-card h1{margin-top:8px;font-family:'Cinzel',serif;letter-spacing:6px;color:var(--gold);font-size:35px}.intro{margin-top:12px;color:rgba(248,241,227,.66);line-height:1.6}
.auth-tabs{display:grid;grid-template-columns:1fr 1fr;margin:30px 0 22px;padding:4px;background:rgba(0,0,0,.18);border-radius:14px}.auth-tabs button{padding:11px;border:0;border-radius:11px;background:transparent;color:rgba(245,230,200,.52);cursor:pointer}.auth-tabs button.active{background:rgba(212,175,55,.12);color:var(--gold-light)}
.auth-form{display:grid;gap:14px}.auth-form label{display:grid;gap:7px;color:rgba(245,230,200,.72);font-size:13px}.auth-form input{border:1px solid rgba(212,175,55,.22);background:rgba(0,0,0,.22);border-radius:12px;padding:12px 14px;color:var(--cream);outline:0}.auth-form input:focus{border-color:rgba(212,175,55,.7);box-shadow:0 0 0 3px rgba(212,175,55,.08)}
.submit-btn{margin-top:8px;border:1px solid rgba(212,175,55,.55);border-radius:12px;padding:13px 16px;background:linear-gradient(135deg,var(--gold),var(--gold-dark));color:#210707;font-weight:700;cursor:pointer}.submit-btn:disabled{opacity:.55;cursor:wait}.form-error{color:#ffb3a8;font-size:13px}.secure-note{margin-top:18px;color:rgba(245,230,200,.38);font-size:11px;line-height:1.5}
@media(max-width:560px){.auth-card{padding:28px}.auth-card h1{font-size:28px;letter-spacing:4px}}
</style>
