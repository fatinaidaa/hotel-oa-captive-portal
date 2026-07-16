window.PORTAL_CONFIG = {
  hotelName: 'HOTEL OA',
  networkName: 'HOTEL OA WiFi',

  /*
    Level 2 mode:
    The captive portal verifies room access through the backend,
    so the dashboard can track active sessions and connection duration.
  */
  useBackend: true,

  /*
    Change this to your deployed backend URL when needed.
    Example: https://hotel-oa-backend.onrender.com
  */
  backendBaseUrl: 'https://hotel-oa-backend.onrender.com',

  /*
    After backend login succeeds, redirect the client back to openNDS
    so openNDS can authenticate the device and allow Internet access.
  */
  openNdsAutoContinue: false,

  endpoints: {
    login: '/api/login',
    requestAccess: '/api/request-device'
  },

  demoPasswords: {
    wrong: 'wrong',
    limitReached: 'limit',
    expired: 'expired',
    pending: 'pending'
  }
}
