# HOTEL OA Level 2 System Runbook

This folder is the safe OpenWrt experiment backend. It does not replace the main
FYP dashboard/backend.

## What this system does

```txt
Guest phone
  -> HOTEL OA WiFi from OpenWrt
  -> openNDS captive page
  -> Hotel OA room login portal
  -> Level 2 backend
  -> Staff dashboard approval / rejection
```

The backend implements:

- room password verification
- per-room device limits
- additional device request submission
- staff approve/reject decision
- AI suggestion by room network condition
- active session duration tracking
- ESP32 room-monitor compatible `/api/node-report`

## Run locally

Open PowerShell:

```powershell
cd "C:\Users\ftnay\OneDrive\Documents\SEM 6\PROJECT FYP\level-2-openwrt-experiment\backend"
npm.cmd start
```

Open:

```txt
http://localhost:3000
```

Health check:

```txt
http://localhost:3000/api/health
```

## Demo room credentials

| Room | Password | Default Limit |
| --- | --- | --- |
| 101 | OA101 | 1 |
| 102 | OA102 | 2 |

## Test flow

1. Open the captive portal page.
2. Login with Room 101 and password `OA101`.
3. Login again with a different MAC/device for Room 101.
4. The second device should receive `Device Limit Exceeded`.
5. Submit phone number for additional request.
6. Staff dashboard shows the request with AI suggestion.
7. Press `Allow`.
8. Room 101 limit increases from `1` to `2`.
9. The guest logs in again.
10. The device is allowed and appears under Connected Users.

## API endpoints

| Endpoint | Purpose |
| --- | --- |
| `POST /api/login` | Verify room password and device limit |
| `POST /api/request-device` | Submit additional device request |
| `GET /api/requests` | Staff request list |
| `POST /api/requests/:id/action` | Allow or reject request |
| `GET /api/rooms` | Room status and limits |
| `GET /api/sessions/active` | Connected users |
| `POST /api/node-report` | ESP32 room monitor data |
| `GET /api/ai/network-insight` | AI suggestion data |

## Connect captive portal to this backend

Edit:

```txt
level-2-openwrt-experiment/openwrt-captive-portal/config.js
```

For local laptop testing:

```js
backendBaseUrl: 'http://localhost:3000'
```

For phone testing through OpenWrt, deploy this backend publicly first, then set:

```js
backendBaseUrl: 'https://YOUR-LEVEL2-BACKEND.onrender.com'
```

## Important note for FYP explanation

OpenWrt handles the real WiFi gateway, captive portal, DHCP, NAT, and Internet
forwarding. The Hotel OA backend handles hotel access-control logic such as room
credentials, device limits, staff approval, and AI-based decision support.
