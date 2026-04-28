# Check-in & Checkout Flows

---

## 1. Check-in - Full Sequence

```mermaid
sequenceDiagram
  participant U as User (Browser PWA)
  participant SW as Service Worker
  participant API as /api/checkin
  participant DB as Database
  participant Nom as Nominatim (async)
  participant IPAPI as ip-api.com

  U->>U: Tap "I'm here"
  U->>U: navigator.geolocation.getCurrentPosition()
  Note over U: 8s timeout. On deny → proceeds with null GPS.
  U->>U: navigator.connection?.ssid (WiFi, Chrome/Android only)
  U->>U: collectDeviceInfo() - user-agent, timezone

  U->>API: POST /api/checkin\n{ gps_lat, gps_lng, gps_accuracy_m,\n  wifi_ssid, device_info, device_timezone }

  API->>API: getServerUser() - reads x-user-id header (never from body)
  API->>DB: getRateLimitCount(userId, 'checkin', 60min)
  alt >= 10 check-ins in last hour
    API-->>U: 429 RATE_LIMITED
  end
  API->>DB: recordRateLimitHit(userId, 'checkin')
  API->>DB: getOpenEventToday(userId) - any event today with no checkout?
  alt already checked in
    API-->>U: 409 ALREADY_CHECKED_IN
  end

  API->>IPAPI: getIpGeo(clientIp) - lat/lng from IP
  API->>DB: createEvent(userId, gps, wifi, ip, device_info, ...)

  API->>DB: setScheduledCheckout(eventId, now + 12h)
  API->>DB: updateUserStats(userId) - fire-and-forget

  alt gps_lat not null
    API->>Nom: reverseGeocodeLabel(lat, lng) - fire-and-forget
    Note over API, Nom: Retries once after 30s on failure
    Nom-->>API: "123 Main St, City"
    API->>DB: updateEventLocationLabel(eventId, label)
  end

  API->>API: evaluateTrust(event) - device timezone vs IP timezone - fire-and-forget

  API-->>U: { event } with scheduled_checkout_at

  U->>U: requestNotificationPermission()
  U->>SW: subscribeToPush() → /api/push/subscribe
  U->>U: Schedule stale reminders at 4h,8h,12h,16h,18h,20h,22h from checkin
  U->>U: Schedule midnight warning at T−15min
  U->>U: Schedule auto-checkout at T+12h
  U->>U: showToast("Checked in!")
```

---

## 2. Checkout - Full Sequence

```mermaid
sequenceDiagram
  participant U as User (Browser PWA)
  participant API as /api/checkin/checkout
  participant DB as Database

  U->>U: Tap "I'm leaving"
  U->>U: navigator.geolocation.getCurrentPosition()
  U->>U: navigator.connection?.ssid (WiFi)

  U->>API: POST /api/checkin/checkout\n{ gps_lat, gps_lng, gps_accuracy_m, wifi_ssid }

  API->>API: getServerUser() - userId from header

  API->>DB: getOpenEvent(userId) - most recent event with no checkout_at
  alt no open event
    API-->>U: 409 NOT_CHECKED_IN
  end

  API->>API: Compute checkout_location_mismatch\n= haversine(checkin_gps, checkout_gps)

  API->>DB: checkoutEvent(eventId, userId, {\n  checkout_gps, checkout_wifi,\n  checkout_ip, checkout_ip_geo,\n  checkout_location_mismatch,\n  checkout_reason\n})
  Note over DB: UPDATE presence_events SET checkout_at = now(),\ncheckout signals, mismatch distance

  API->>DB: updateUserStats(userId) - fire-and-forget
  API-->>U: { success: true, duration_hours }

  U->>U: Cancel all notification timers
  U->>U: localStorage.removeItem stale notif keys
  U->>U: showToast("Checked out - Xh logged")
```

---

## 3. Notification Timer Scheduling (Client-Side)

```mermaid
gantt
  title Client-side timer schedule from T=0 (check-in)
  dateFormat HH:mm
  axisFormat %Hh

  section Stale Reminders
  4h reminder     :milestone, 04:00, 0m
  8h reminder     :milestone, 08:00, 0m
  12h reminder    :milestone, 12:00, 0m
  16h reminder    :milestone, 16:00, 0m
  18h reminder    :milestone, 18:00, 0m
  20h reminder    :milestone, 20:00, 0m
  22h reminder    :milestone, 22:00, 0m

  section Auto-checkout
  15-min warning  :milestone, 11:45, 0m
  Auto-checkout   :milestone, 12:00, 0m
```

These timers are scheduled in a `useEffect` on `activeEvent` - they are re-scheduled on page reload using the persisted `checkin_at` and `scheduled_checkout_at` from the server. Timer IDs stored in a `useRef<number[]>` and cancelled on checkout.

---

## 4. Auto-Checkout (Client-Triggered)

```mermaid
sequenceDiagram
  participant Timer as Browser setTimeout
  participant API as /api/checkin/checkout
  participant DB as Database

  Timer->>API: POST /api/checkin/checkout\n{ reason: 'midnight_auto_checkout' }
  API->>DB: getOpenEvent(userId)
  API->>DB: checkoutEvent(..., checkout_reason='midnight_auto_checkout')
  API-->>Timer: { success: true }
  Timer->>Timer: window.location.reload()
```

`checkout_reason` is stored in `presence_events` - admins can see it was an automatic checkout, not a manual one.

---

## 5. Extend Auto-Checkout (+8 Hours)

```mermaid
sequenceDiagram
  participant SW as Service Worker (notification action)
  participant API as /api/checkin/extend
  participant DB as Database
  participant Client as CheckinButtons (if open)

  Note over SW: User clicks "Still here (+8h)" action on notification
  SW->>API: POST /api/checkin/extend\n(credentials: 'include' - cookie auth)
  API->>API: getServerUser()
  API->>DB: getOpenEvent(userId)
  alt no open event
    API-->>SW: 409 NOT_CHECKED_IN
  end
  API->>DB: setScheduledCheckout(eventId, now + 8h)
  API-->>SW: { scheduled_checkout_at }

  Note over Client: If page is open, useEffect re-runs\non scheduled_checkout_at change\n→ reschedules warning + auto-checkout timers
```

---

## 6. V1 API Check-in (Programmatic)

For devices/scripts that can't use the browser PWA:

```mermaid
sequenceDiagram
  participant C as API Client (script/device)
  participant API as /api/v1/checkin
  participant DB as Database

  C->>API: POST /api/v1/checkin\nAuthorization: Bearer <token>\n{ gps_lat?, gps_lng?, wifi_ssid? }

  API->>API: Extract prefix = bearer.slice(0,8)
  API->>DB: getApiTokensByPrefix(prefix)
  loop bcrypt compare over candidates
    API->>API: bcrypt.compare(token, candidate.token_hash)
  end
  alt no match or revoked
    API-->>C: 401 INVALID_TOKEN
  end
  API->>DB: recordLastUsed(tokenId)
  API->>DB: createEvent(userId, source='api_token', ...)
  API-->>C: { event }
```

---

## 7. What Gets Stored Per Check-in

```
presence_events row:
  id                       UUID
  user_id                  FK → users
  event_type               'checkin' | 'wfh' | 'leave'
  checkin_at               UTC timestamp
  checkout_at              UTC timestamp (null until checkout)
  scheduled_checkout_at    UTC timestamp (T+12h from checkin)
  checkout_reason          null | 'midnight_auto_checkout' | 'maximum_hours_exceeded'
  
  # Check-in signals
  gps_lat, gps_lng         float | null
  gps_accuracy_m           int | null
  wifi_ssid                string | null (raw SSID - user's own data)
  ip_address               string | null
  ip_geo_lat, ip_geo_lng   float | null
  
  # Checkout signals (collected again at checkout)
  checkout_gps_lat/lng     float | null
  checkout_gps_accuracy_m  int | null
  checkout_wifi_ssid       string | null
  checkout_ip_*            float | null
  checkout_location_mismatch  metres (float) | null
  
  # Metadata
  location_label           "123 Main St" (async, may be null)
  device_info              JSON string
  device_timezone          IANA timezone string
  note                     string (only field editable after insert)
  source                   'user_app' | 'api_token'
  api_token_id             FK | null
```
