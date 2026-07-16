const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 3000

const DATA_FILE = path.join(__dirname, 'data-level2.json')

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

const nowIso = () => new Date().toISOString()

const normalizeRoom = (value) => String(value || '').trim()
const normalizeMac = (value) => String(value || '').trim().toUpperCase()

const defaultData = () => ({
  rooms: [
    {
      id: '101',
      password: 'OA101',
      device_limit: 1,
      default_device_limit: 1,
      check_in: '2026-07-16',
      check_out: '2026-07-20'
    },
    {
      id: '102',
      password: 'OA102',
      device_limit: 2,
      default_device_limit: 2,
      check_in: '2026-07-16',
      check_out: '2026-07-20'
    }
  ],
  sessions: [],
  requests: [],
  metrics: [
    {
      room_id: '101',
      node_id: 'child_101',
      rssi: -48,
      wifi_latency_ms: 8,
      wifi_jitter_ms: 4,
      wifi_packet_loss: 0,
      wifi_success_rate: 100,
      updated_at: nowIso()
    },
    {
      room_id: '102',
      node_id: 'child_102',
      rssi: -55,
      wifi_latency_ms: 12,
      wifi_jitter_ms: 6,
      wifi_packet_loss: 0,
      wifi_success_rate: 100,
      updated_at: nowIso()
    }
  ]
})

const readData = () => {
  if (!fs.existsSync(DATA_FILE)) {
    const data = defaultData()
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
    return data
  }

  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
}

const writeData = (data) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
}

const findRoom = (data, roomId) =>
  data.rooms.find((room) => String(room.id) === String(roomId))

const activeSessionsForRoom = (data, roomId) =>
  data.sessions.filter(
    (session) =>
      String(session.room_id) === String(roomId) &&
      session.status === 'connected' &&
      !session.disconnect_time
  )

const activeSessionForMac = (data, mac) =>
  data.sessions.find(
    (session) =>
      normalizeMac(session.mac_address) === normalizeMac(mac) &&
      session.status === 'connected' &&
      !session.disconnect_time
  )

const latestMetricForRoom = (data, roomId) =>
  data.metrics
    .filter((metric) => String(metric.room_id) === String(roomId))
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0] || null

const getSignalStatus = (rssi) => {
  if (rssi >= -60) return 'Excellent'
  if (rssi >= -70) return 'Good'
  if (rssi >= -80) return 'Fair'
  return 'Poor'
}

const buildAiSuggestion = (room, metric, connectedCount) => {
  const issues = []

  if (!metric) {
    return {
      decision: 'REVIEW',
      confidence: 55,
      message:
        'No recent room monitoring data is available. Staff should review manually before approving.'
    }
  }

  if (metric.rssi < -70) issues.push('weak WiFi signal')
  if (metric.wifi_latency_ms > 50) issues.push('high WiFi latency')
  if (metric.wifi_jitter_ms > 20) issues.push('unstable jitter')
  if (metric.wifi_packet_loss > 2) issues.push('packet loss detected')

  if (connectedCount >= room.device_limit) {
    issues.push('room has reached the current device limit')
  }

  if (issues.length === 0) {
    return {
      decision: 'ALLOW',
      confidence: 92,
      message:
        'Room network condition is stable. One additional device can be approved without major service impact.'
    }
  }

  if (issues.length <= 2 && metric.wifi_success_rate >= 95) {
    return {
      decision: 'ALLOW WITH CAUTION',
      confidence: 74,
      message: `Approval is possible, but staff should monitor the room because ${issues.join(
        ', '
      )}.`
    }
  }

  return {
    decision: 'REJECT',
    confidence: 86,
    message: `Additional device approval is not recommended because ${issues.join(
      ', '
    )}.`
  }
}

const roomToDto = (data, room) => {
  const sessions = activeSessionsForRoom(data, room.id)
  const metric = latestMetricForRoom(data, room.id)

  return {
    id: room.id,
    room_id: room.id,
    wifi_password: room.password,
    device_limit: room.device_limit,
    default_device_limit: room.default_device_limit,
    check_in: room.check_in,
    check_out: room.check_out,
    connected: sessions.length,
    status:
      sessions.length === 0
        ? 'Empty'
        : sessions.length >= room.device_limit
          ? 'Full'
          : 'Occupied',
    metric: metric
      ? {
          ...metric,
          signal_status: getSignalStatus(metric.rssi)
        }
      : null
  }
}

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'hotel-oa-level2-openwrt-backend',
    time: nowIso()
  })
})

app.get('/api/summary', (req, res) => {
  const data = readData()
  const activeSessions = data.sessions.filter(
    (session) => session.status === 'connected' && !session.disconnect_time
  )
  const pendingRequests = data.requests.filter(
    (request) => request.status === 'pending'
  )

  res.json({
    total_rooms: data.rooms.length,
    connected_devices: activeSessions.length,
    pending_requests: pendingRequests.length,
    active_sessions: activeSessions.length
  })
})

app.get('/api/rooms', (req, res) => {
  const data = readData()
  res.json(data.rooms.map((room) => roomToDto(data, room)))
})

app.get('/api/sessions/active', (req, res) => {
  const data = readData()

  res.json(
    data.sessions
      .filter((session) => session.status === 'connected' && !session.disconnect_time)
      .map((session) => ({
        ...session,
        duration_seconds: Math.max(
          0,
          Math.floor((Date.now() - new Date(session.login_time).getTime()) / 1000)
        )
      }))
  )
})

app.post('/api/login', (req, res) => {
  const data = readData()

  const roomId = normalizeRoom(req.body.room || req.body.room_id)
  const password = String(req.body.password || '').trim()
  const mac = normalizeMac(req.body.mac || req.body.clientMac || req.body.client_mac)
  const clientIp = String(req.body.clientIp || req.body.client_ip || req.body.ip || '')

  const room = findRoom(data, roomId)

  if (!room || room.password !== password) {
    return res.status(401).json({
      success: false,
      status: 'wrong',
      message: 'Invalid room number or WiFi password.'
    })
  }

  const today = new Date()
  const checkIn = new Date(`${room.check_in}T00:00:00`)
  const checkOut = new Date(`${room.check_out}T23:59:59`)

  if (today < checkIn || today > checkOut) {
    return res.status(403).json({
      success: false,
      status: 'expired',
      message: 'Room WiFi access is not active for the current stay period.'
    })
  }

  if (mac) {
    const existingSession = activeSessionForMac(data, mac)

    if (existingSession) {
      existingSession.last_seen = nowIso()
      writeData(data)

      return res.json({
        success: true,
        status: 'success',
        alreadyConnected: true,
        message: 'Device is already connected.'
      })
    }
  }

  const connected = activeSessionsForRoom(data, roomId)
  const approvedRequest = data.requests.find(
    (request) =>
      request.status === 'approved' &&
      !request.used &&
      normalizeMac(request.mac_address) === mac &&
      String(request.room_id) === String(roomId)
  )

  if (connected.length >= room.device_limit && !approvedRequest) {
    return res.status(409).json({
      success: false,
      status: 'limit',
      limitExceeded: true,
      message: 'Room device limit has been reached.'
    })
  }

  if (approvedRequest) {
    approvedRequest.used = true
    approvedRequest.used_at = nowIso()
  }

  const session = {
    id: `S-${Date.now()}`,
    room_id: roomId,
    device_name: 'Guest Device',
    phone_number: req.body.phone || req.body.phoneNumber || null,
    mac_address: mac || `UNKNOWN-${Date.now()}`,
    ip_address: clientIp || null,
    status: 'connected',
    access_source: 'openwrt_captive_portal',
    login_time: nowIso(),
    last_seen: nowIso(),
    disconnect_time: null
  }

  data.sessions.push(session)
  writeData(data)

  res.json({
    success: true,
    status: 'success',
    message: 'Access granted.',
    session,
    room: roomToDto(data, room)
  })
})

app.post('/api/request-device', (req, res) => {
  const data = readData()

  const roomId = normalizeRoom(req.body.room || req.body.room_id)
  const phone = String(req.body.phone || req.body.phoneNumber || '').trim()
  const mac = normalizeMac(req.body.mac || req.body.clientMac || req.body.client_mac)
  const room = findRoom(data, roomId)

  if (!room) {
    return res.status(404).json({
      success: false,
      message: 'Room not found.'
    })
  }

  const existing = data.requests.find(
    (request) =>
      request.status === 'pending' &&
      normalizeMac(request.mac_address) === mac &&
      String(request.room_id) === String(roomId)
  )

  if (existing) {
    return res.json({
      success: true,
      status: 'pending',
      message: 'Request already pending.',
      request: existing
    })
  }

  const metric = latestMetricForRoom(data, roomId)
  const suggestion = buildAiSuggestion(
    room,
    metric,
    activeSessionsForRoom(data, roomId).length
  )

  const request = {
    id: `R-${Date.now()}`,
    room_id: roomId,
    phone_number: phone,
    mac_address: mac || `UNKNOWN-${Date.now()}`,
    status: 'pending',
    ai_suggestion: suggestion,
    created_at: nowIso(),
    decided_at: null,
    used: false
  }

  data.requests.push(request)
  writeData(data)

  res.json({
    success: true,
    status: 'pending',
    message: 'Additional device request submitted.',
    request
  })
})

app.get('/api/requests', (req, res) => {
  const data = readData()

  res.json(
    data.requests
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  )
})

app.get('/api/pending-requests', (req, res) => {
  const data = readData()
  res.json(data.requests.filter((request) => request.status === 'pending'))
})

const updateRequest = (req, res, action) => {
  const data = readData()
  const id = req.params.id || req.body.id
  const request = data.requests.find((item) => item.id === id)

  if (!request) {
    return res.status(404).json({
      success: false,
      message: 'Request not found.'
    })
  }

  if (request.status !== 'pending') {
    return res.json({
      success: true,
      message: 'Request already decided.',
      request
    })
  }

  request.status = action === 'allow' ? 'approved' : 'rejected'
  request.decided_at = nowIso()

  if (action === 'allow') {
    const room = findRoom(data, request.room_id)

    if (room) {
      room.device_limit += 1
    }
  }

  writeData(data)

  res.json({
    success: true,
    message:
      action === 'allow'
        ? 'Request approved. Room device limit has been increased.'
        : 'Request rejected. Room device limit remains unchanged.',
    request
  })
}

app.post('/api/requests/:id/action', (req, res) => {
  const action = String(req.body.action || '').toLowerCase()

  if (!['allow', 'reject'].includes(action)) {
    return res.status(400).json({
      success: false,
      message: 'Action must be allow or reject.'
    })
  }

  updateRequest(req, res, action)
})

app.put('/api/requests/:id/allow', (req, res) => updateRequest(req, res, 'allow'))
app.put('/api/requests/:id/reject', (req, res) => updateRequest(req, res, 'reject'))

app.post('/api/approve-request', (req, res) => {
  req.params.id = req.body.id
  updateRequest(req, res, 'allow')
})

app.post('/api/reject-request', (req, res) => {
  req.params.id = req.body.id
  updateRequest(req, res, 'reject')
})

app.delete('/api/sessions/:mac', (req, res) => {
  const data = readData()
  const mac = normalizeMac(req.params.mac)
  const session = activeSessionForMac(data, mac)

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Active session not found.'
    })
  }

  session.status = 'disconnected'
  session.disconnect_time = nowIso()
  writeData(data)

  res.json({
    success: true,
    message: 'Session disconnected.',
    session
  })
})

app.post('/api/disconnect', (req, res) => {
  const data = readData()
  const mac = normalizeMac(req.body.mac || req.body.mac_address || req.body.clientMac)
  const session = activeSessionForMac(data, mac)

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Active session not found.'
    })
  }

  session.status = 'disconnected'
  session.disconnect_time = nowIso()
  writeData(data)

  res.json({
    success: true,
    message: 'Session disconnected.',
    session
  })
})

app.get('/api/nodes', (req, res) => {
  const data = readData()

  res.json(
    data.metrics.map((metric) => ({
      node_id: metric.node_id,
      room_id: metric.room_id,
      rssi: metric.rssi,
      signal_quality: getSignalStatus(metric.rssi),
      wifi_latency_ms: metric.wifi_latency_ms,
      wifi_jitter_ms: metric.wifi_jitter_ms,
      wifi_packet_loss: metric.wifi_packet_loss,
      wifi_success_rate: metric.wifi_success_rate,
      status: 'online',
      last_seen: metric.updated_at
    }))
  )
})

app.post('/api/node-report', (req, res) => {
  const data = readData()
  const roomId = normalizeRoom(req.body.room || req.body.room_id)

  const metric = {
    room_id: roomId,
    node_id: req.body.node_id || req.body.nodeId || `child_${roomId}`,
    rssi: Number(req.body.rssi ?? -60),
    wifi_latency_ms: Number(req.body.wifi_latency_ms ?? req.body.latency_ms ?? 0),
    wifi_jitter_ms: Number(req.body.wifi_jitter_ms ?? req.body.jitter_ms ?? 0),
    wifi_packet_loss: Number(req.body.wifi_packet_loss ?? req.body.packet_loss ?? 0),
    wifi_success_rate: Number(req.body.wifi_success_rate ?? req.body.success_rate ?? 100),
    updated_at: nowIso()
  }

  data.metrics = data.metrics.filter(
    (item) => String(item.room_id) !== String(roomId)
  )
  data.metrics.push(metric)
  writeData(data)

  res.json({
    success: true,
    message: 'Node metric updated.',
    metric
  })
})

app.get('/api/traffic', (req, res) => {
  const data = readData()

  res.json(
    data.metrics.map((metric) => ({
      time: metric.updated_at,
      room_id: metric.room_id,
      latency: metric.wifi_latency_ms,
      jitter: metric.wifi_jitter_ms,
      packet_loss: metric.wifi_packet_loss,
      success_rate: metric.wifi_success_rate
    }))
  )
})

app.get('/api/ai/network-insight', (req, res) => {
  const data = readData()

  const rooms = data.rooms.map((room) => {
    const metric = latestMetricForRoom(data, room.id)
    const connectedCount = activeSessionsForRoom(data, room.id).length

    return {
      room_id: room.id,
      connected: connectedCount,
      limit: room.device_limit,
      suggestion: buildAiSuggestion(room, metric, connectedCount),
      metric
    }
  })

  res.json({
    generated_at: nowIso(),
    summary:
      'AI suggestions are generated from room connection count, RSSI, WiFi latency, jitter, packet loss, and success rate.',
    rooms
  })
})

app.post('/api/reset-demo', (req, res) => {
  const data = defaultData()
  writeData(data)

  res.json({
    success: true,
    message: 'Level 2 demo data has been reset.',
    data
  })
})

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Hotel OA Level 2 backend running on port ${PORT}`)
  console.log(`Dashboard: http://localhost:${PORT}`)
  console.log(`Health: http://localhost:${PORT}/api/health`)
})
