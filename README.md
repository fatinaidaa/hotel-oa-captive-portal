# OpenWrt Captive Portal Prototype

This folder contains a standalone captive portal UI prototype for a future
OpenWrt/openNDS version of the HOTEL OA network access system.

It does not replace the current ESP32 captive portal implementation.

## Purpose

- Prepare a cleaner guest WiFi access page for future OpenWrt integration.
- Keep the existing ESP32 architecture safe while testing OpenWrt separately.
- Provide screenshots and UI material for the FYP report/future work section.

## Files

- `index.html` — portal page markup
- `style.css` — hotel-style responsive UI
- `script.js` — local prototype behaviour
- `config.js` — backend URL and demo settings

## Level 2 Backend Mode

The portal is currently configured for Level 2 testing:

```js
useBackend: true
```

In this mode, the page submits room number, password, and client MAC/IP details
to the backend:

- `POST /api/login` validates room access and creates an active session.
- `POST /api/request-device` submits an additional device request.
- The staff dashboard reads the active session duration from the database.

This makes the dashboard the main control point for hotel access management.

## Prototype Test Values

If `useBackend` is changed back to `false`, use these password values to
simulate different states:

| Password | Result |
| --- | --- |
| Any normal text | Access granted |
| `wrong` | Invalid credentials |
| `limit` | Device limit reached and request panel shown |
| `expired` | Stay period expired |
| `pending` | Additional device request still pending |

The page also has demo buttons, so the same states can be tested without typing
the passwords manually.

## OpenWrt/openNDS Compatibility

This prototype uses plain HTML, CSS, and JavaScript only. No React build step is
required, so it is easy to serve from OpenWrt or openNDS.

The page can read common captive portal query values from the URL:

- `clientmac`
- `clientip`
- `gatewayname`
- `tok`

Example:

```txt
index.html?clientmac=AA:BB:CC:DD:EE:FF&clientip=192.168.10.20&gatewayname=HOTEL-OA
```

## Backend Connection

For Render/public testing, keep:

```js
backendBaseUrl: 'https://hotel-oa-backend.onrender.com'
```

For local backend testing, change it to:

```js
backendBaseUrl: 'http://localhost:3000'
```

## Future Integration Notes

For OpenWrt/openNDS, this page can later be adapted to call the existing backend
API for:

- room credential verification
- MAC/IP based device access
- additional device request submission
- staff dashboard approval flow

The current project can continue using the ESP32 captive portal if OpenWrt
hardware integration is not ready in time.
