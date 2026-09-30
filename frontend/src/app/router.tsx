import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from '@/features/auth/LoginPage'
import RegisterPage from '@/features/auth/RegisterPage'
import AppShell from '@/app/AppShell'
import { RTCBridge } from '@/components/rtc/RTCBridge'
import { CallOverlay, IncomingCallToast } from '@/components/rtc/CallOverlay'
import { VoiceDock } from '@/components/rtc/VoiceDock'

export function AppRouter() {
  return (
    <BrowserRouter>
      <RTCBridge />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<AppShell page="home" />} />
        <Route path="/server" element={<AppShell page="server" />} />
        <Route path="/settings" element={<AppShell page="settings" />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
      <IncomingCallToast />
      <CallOverlay />
      <VoiceDock />
    </BrowserRouter>
  )
}
