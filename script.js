const config = window.PORTAL_CONFIG || {}
const query = new URLSearchParams(window.location.search)

const loginForm = document.getElementById('loginForm')
const requestForm = document.getElementById('requestForm')
const requestPanel = document.getElementById('requestPanel')
const messageBox = document.getElementById('messageBox')
const statusBox = document.getElementById('statusBox')
const statusIcon = document.getElementById('statusIcon')
const statusTitle = document.getElementById('statusTitle')
const statusText = document.getElementById('statusText')
const deviceInfo = document.getElementById('deviceInfo')
const continueButton = document.getElementById('continueButton')

const client = {
  mac:
    query.get('clientmac') ||
    query.get('client_mac') ||
    query.get('mac') ||
    query.get('clientid') ||
    '',
  ip: query.get('clientip') || query.get('client_ip') || query.get('ip') || '',
  token: query.get('tok') || query.get('token') || '',
  gateway: query.get('gatewayname') || query.get('gateway') || 'OpenWrt',
  authAction:
    query.get('authaction') ||
    query.get('auth_action') ||
    query.get('authurl') ||
    ''
}

const setClass = (element, className) => {
  element.className = className
}

const hide = (element) => {
  element.classList.add('hidden')
}

const show = (element) => {
  element.classList.remove('hidden')
}

const getClientMac = () => client.mac || client.token || `openwrt-${Date.now()}`

const showMessage = (type, text) => {
  setClass(messageBox, `message ${type}`)
  messageBox.textContent = text
}

const clearMessage = () => {
  setClass(messageBox, 'message hidden')
  messageBox.textContent = ''
}

const showStatus = (type, title, text, icon) => {
  setClass(statusBox, `status ${type}`)
  statusIcon.textContent = icon
  statusTitle.textContent = title
  statusText.textContent = text
}

const clearStatus = () => {
  setClass(statusBox, 'status hidden')
}

const mapBackendStatus = (data) => {
  if (data.success) return 'success'
  if (data.limitExceeded) return 'limit'

  const message = String(data.message || '').toLowerCase()

  if (message.includes('wrong') || message.includes('invalid')) return 'wrong'
  if (message.includes('expired') || message.includes('starts on')) return 'expired'
  if (message.includes('pending')) return 'pending'

  return data.status || 'wrong'
}

const requestBackend = async (path, payload) => {
  const baseUrl = String(config.backendBaseUrl || '').replace(/\/$/, '')
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    throw new Error('Backend request failed')
  }

  return response.json()
}

const continueInternet = () => {
  if (client.authAction) {
    window.location.href = client.authAction
    return
  }

  if (client.token) {
    window.location.href =
      `http://status.client/opennds_auth/?tok=${encodeURIComponent(client.token)}`
    return
  }

  showMessage(
    'warning',
    'No openNDS token was received. Please reconnect to HOTEL OA and try again.'
  )
}

const handleLoginResult = (status, room) => {
  hide(requestPanel)
  hide(continueButton)
  clearMessage()

  if (status === 'success') {
    showStatus(
      'success',
      'Access Granted',
      `Room ${room} has been verified successfully.`,
      'OK'
    )

    if (client.authAction || client.token) {
      show(continueButton)
    }
    return
  }

  if (status === 'limit') {
    showStatus(
      'warning',
      'Device Limit Exceeded',
      `Room ${room} has reached maximum device connections.`,
      '!'
    )
    show(requestPanel)
    return
  }

  if (status === 'expired') {
    showStatus(
      'danger',
      'Access Expired',
      `Room ${room} WiFi access is no longer active.`,
      'NO'
    )
    return
  }

  if (status === 'pending') {
    showStatus(
      'warning',
      'Request Still Pending',
      'Your additional device request is waiting for staff approval.',
      'WAIT'
    )
    return
  }

  showStatus(
    'danger',
    'Access Denied',
    'Invalid room number or WiFi password. Please contact the front desk.',
    'NO'
  )
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault()

  const room = document.getElementById('roomInput').value.trim()
  const password = document.getElementById('passwordInput').value.trim()

  clearMessage()
  clearStatus()
  hide(requestPanel)
  hide(continueButton)

  if (!room || !password) {
    showMessage('danger', 'Please fill in all fields.')
    return
  }

  if (!config.useBackend) {
    handleLoginResult(password.toLowerCase() === 'limit' ? 'limit' : 'success', room)
    return
  }

  try {
    const data = await requestBackend(config.endpoints.login, {
      room,
      password,
      mac: getClientMac(),
      clientMac: getClientMac(),
      clientIp: client.ip,
      gateway: client.gateway,
      token: client.token
    })

    handleLoginResult(mapBackendStatus(data), room)
  } catch (error) {
    showMessage('danger', 'Server error. Please try again or contact the front desk.')
  }
})

requestForm.addEventListener('submit', async (event) => {
  event.preventDefault()

  const room = document.getElementById('roomInput').value.trim()
  const phone = document.getElementById('phoneInput').value.trim()

  clearMessage()

  if (!phone) {
    showMessage('danger', 'Please enter your phone number.')
    return
  }

  try {
    if (config.useBackend) {
      await requestBackend(config.endpoints.requestAccess, {
        room,
        phone,
        phoneNumber: phone,
        mac: getClientMac(),
        clientMac: getClientMac(),
        clientIp: client.ip,
        gateway: client.gateway
      })
    }

    hide(requestPanel)
    requestForm.reset()
    showMessage(
      'success',
      'Additional device request submitted. Please wait for staff approval.'
    )
  } catch (error) {
    showMessage('danger', 'Unable to submit request. Please try again.')
  }
})

continueButton.addEventListener('click', continueInternet)

if (client.mac || client.ip || client.token) {
  const parts = []
  if (client.mac) parts.push(`MAC: ${client.mac}`)
  if (client.ip) parts.push(`IP: ${client.ip}`)
  if (client.token) parts.push('openNDS session detected')

  deviceInfo.textContent = parts.join(' | ')
  show(deviceInfo)
}
