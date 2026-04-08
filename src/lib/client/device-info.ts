export interface DeviceInfo {
  user_agent: string
  platform: string
  language: string
  hardware_concurrency: number | null
  device_memory: number | null
  max_touch_points: number
  screen_width: number
  screen_height: number
  screen_color_depth: number
  device_pixel_ratio: number
  connection_type: string | null
  connection_downlink: number | null
  timezone: string
  timezone_offset: number
  is_standalone: boolean
  battery_level: number | null
  battery_charging: boolean | null
  gpu_renderer: string | null
  gpu_vendor: string | null
}

export async function collectDeviceInfo(): Promise<DeviceInfo> {
  const nav = navigator as Navigator & {
    deviceMemory?: number
    connection?: { effectiveType?: string; downlink?: number }
    getBattery?: () => Promise<{ level: number; charging: boolean }>
  }

  const info: DeviceInfo = {
    user_agent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    hardware_concurrency: navigator.hardwareConcurrency ?? null,
    device_memory: nav.deviceMemory ?? null,
    max_touch_points: navigator.maxTouchPoints,
    screen_width: screen.width,
    screen_height: screen.height,
    screen_color_depth: screen.colorDepth,
    device_pixel_ratio: window.devicePixelRatio,
    connection_type: nav.connection?.effectiveType ?? null,
    connection_downlink: nav.connection?.downlink ?? null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezone_offset: new Date().getTimezoneOffset(),
    is_standalone: window.matchMedia('(display-mode: standalone)').matches,
    battery_level: null,
    battery_charging: null,
    gpu_renderer: null,
    gpu_vendor: null,
  }

  try {
    if (nav.getBattery) {
      const battery = await nav.getBattery()
      info.battery_level = battery.level
      info.battery_charging = battery.charging
    }
  } catch { /* unavailable */ }

  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') as WebGLRenderingContext | null
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info')
      if (ext) {
        info.gpu_renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        info.gpu_vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)
      }
    }
  } catch { /* unavailable */ }

  return info
}
