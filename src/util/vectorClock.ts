import { Request } from "express"
import { socket } from "./store"
import { IVectorClock } from "./interfaces"
import { shardId, shardMemberMap } from "./shard"

// Maps a socket to a count
// Ex: ['192.168.8.1']: 2
let vectorClock: IVectorClock = {} 

// If replica (not in view) joins, it waits to be assigned a shard
// Each replica tracks vector clock of all members in the shard
if (shardId !== undefined) {
  for (const member of shardMemberMap[shardId!]) {
    vectorClock[member] = 0
  }
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
