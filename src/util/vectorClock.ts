import { Request } from "express"
import { socket, view } from "./store"
import { IVectorClock } from "./interfaces"

// Maps a socket to a count
// Ex: ['192.168.8.1']: 2
let vectorClock: IVectorClock = {} 

for (const sock of view) {
  vectorClock[sock] = 0
}

// Can have this function create new nodes in the future
const setVectorClock = (newVectorClock: IVectorClock) => vectorClock = newVectorClock

const updateVectorClock = (req: Request) => {
  const origin = req.headers.origin
  const metadata = req.body['causal-metadata'] || {}

  if (origin === undefined) {
    vectorClock[socket] += 1
    return
  }

  for (const [sock, count] of Object.entries(vectorClock)) {
    const timestampCount = metadata[sock] || 0
    vectorClock[sock] = Math.max(timestampCount, count)
  }
}

export { vectorClock, updateVectorClock, setVectorClock }
