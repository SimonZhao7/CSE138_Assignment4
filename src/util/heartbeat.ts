import { broadcastChangesAsync } from "./broadcastChanges"
import { headers } from "./constants"
import { socket, view } from "./store"

export const HEARTBEAT_INITIAL_DELAY_MS = 0.75 * 1000
const HEARTBEAT_INTERVAL_MS = 0.30 * 1000
const HEARTBEAT_TIMEOUT_MS = 0.70 * 1000

let heartbeatSocket = ''
let intervalId: NodeJS.Timeout | undefined

export const setHeartbeatSocket = (newHeartbeatSocket: string) => heartbeatSocket = newHeartbeatSocket

export const calculateHeartbeatSocket = () => {
  clearInterval(intervalId)

  const a = Array.from(view)
  
  if (a.length <= 2) return

  const idx = a.findIndex(x => x === socket)
  let newHeartSocket = idx !== (a.length - 1) ? a[idx + 1]: a[0]
  heartbeatSocket = newHeartSocket

  if (newHeartSocket === socket) return

  intervalId = setInterval(() => {
    sendHeartbeat()
  }, HEARTBEAT_INTERVAL_MS)
}

const sendHeartbeat = async () => {

  const controller = new AbortController()
  setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT_MS);

  try {
    await fetch(`http://${heartbeatSocket}/status`, {
      method: 'HEAD',
      signal: controller.signal
    })
    console.log(`Heartbeat ${heartbeatSocket} OK`)
  } catch (e) {
    console.log(`Heartbeat ${heartbeatSocket} FAILED`)
    view.delete(heartbeatSocket)
    console.log(view)
    clearInterval(intervalId)
    broadcastChangesAsync('view', 'DELETE', {[headers.socketAddress]: heartbeatSocket}, {origin: socket})
    calculateHeartbeatSocket()
  }
}