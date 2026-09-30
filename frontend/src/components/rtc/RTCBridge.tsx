import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { rtcService } from '@/features/rtc/rtc.service'

export function RTCBridge() {
  const user = useAuth((s) => s.user)
  useEffect(() => {
    if (!user) {
      rtcService.shutdown()
      return
    }
    void rtcService.initialize(user)
  }, [user?.id])
  return null
}
