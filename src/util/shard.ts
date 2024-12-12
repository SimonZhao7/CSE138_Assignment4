import md5 from 'md5'
import { IKeyValuePairs, IShardMemberMap, IVectorClock } from './interfaces'
import { view } from './store'
import { v4 as uuidv4 } from 'uuid'

// What to do if a new member joins the view?
const SHARD_COUNT = Number(process.env.SHARD_COUNT)
const VIEW = process.env.VIEW!
const socket = process.env.SOCKET_ADDRESS!

export const NODE_COUNT = 2 ** 32

export let shardIds: number[] = []
export let shardMemberMap: IShardMemberMap = {}
export let shardId = NaN

export const hashKey = (key: string) => {
  return parseInt(md5(key), 16) % NODE_COUNT
}

const getShardKVs = (shardId: number) => {
  return fetch(`http://${socket}/shard/kvs/${shardId}`)
    .then((res) => res.json())
    .then((data) => data)
}

const addShard = async () => {
  const newShardId = hashKey(uuidv4())
  const insertIndex = shardIds.findIndex((id) => id > newShardId)

  if (insertIndex === -1) {
    shardIds.push(newShardId)
  } else {
    shardIds.splice(insertIndex, 0, newShardId)
  }

  const nextShardId = shardIds[(insertIndex + 1) % shardIds.length]
  const { store: nextShardKVs } = await getShardKVs(nextShardId)

  const newShardKVs: IKeyValuePairs = {}
  for (const [key, value] of Object.entries(nextShardKVs)) {
    const hash = hashKey(key)
    // Does this handle inserting new shard to front of shardIds?
    if (hash <= newShardId || hash > shardIds[shardIds.length - 1]) {
      newShardKVs[key] = value
    }
  }

  // Round robin to move sockets from existing shards to new shard
  let shardPtr = 0
  shardMemberMap[newShardId] = []
  const targetShardNodeCount = Math.floor(view.size / shardIds.length)

  while (shardMemberMap[newShardId].length < targetShardNodeCount) {
    if (
      shardIds[shardPtr] !== newShardId &&
      shardMemberMap[shardIds[shardPtr]].length > 2
    ) {
      const socketToMove = shardMemberMap[shardIds[shardPtr]].pop()!
      shardMemberMap[newShardId].push(socketToMove)
    }
    shardPtr = (shardPtr + 1) % shardIds.length
  }

  // Reset vector clocks for sockets in new shard
  const newVectorClock: IVectorClock = {}
  for (const sock of shardMemberMap[newShardId]) {
    newVectorClock[sock] = 0
  }

  for (const sock of shardMemberMap[newShardId]) {
    await fetch(`http://${sock}/reset/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        origin: socket,
        'x-overwrite-metadata': 'true',
      },
      body: JSON.stringify({
        shardId: newShardId,
        store: newShardKVs,
        'causal-metadata': newVectorClock,
      }),
    })
  }
}

const addShards = (shardCount: number) => {
  for (let i = 0; i < shardCount; i++) {
    addShard()
  }
}

const removeShards = async (shardCount: number) => {
  // Evenly distribute removal of shards
  const loopIncrement = Math.floor(shardIds.length / shardCount)

  for (let i = 0; i < shardCount; i += loopIncrement) {
    const idToRemove = shardIds[i]
    const nextShardId = shardIds[(i + 1) % shardIds.length]
    const { store: removedKVs, 'causal-metadata': removedVectorClock } =
      await getShardKVs(idToRemove)
    const { store: nextShardKVs, 'causal-metadata': nextShardVectorClock } =
      await getShardKVs(shardIds[nextShardId])

    for (const [key, value] of Object.entries(removedKVs)) {
      nextShardKVs[key] = value
    }

    for (const sock of shardMemberMap[nextShardId]) {
      await fetch(`http://${sock}/reset/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          origin: socket,
        },
        body: JSON.stringify({
          store: nextShardKVs.store,
          'causal-metadata': removedVectorClock,
        }),
      })
    }

    shardIds.splice(i, 1)
    while (shardMemberMap[idToRemove].length > 0) {
      const socketToMove = shardMemberMap[idToRemove].pop()!
      shardMemberMap[nextShardId].push(socketToMove)
      await fetch(`http://${socketToMove}/reset/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          origin: socket,
        },
        body: JSON.stringify({
          shardId: nextShardId,
          store: nextShardKVs,
          'causal-metadata': nextShardVectorClock,
        }),
      })
    }
  }
}

// Initialize shards consistently across nodes in view
// Utilize their view index to assign shards
export const initializeShard = () => {
  if (SHARD_COUNT < 0) {
    return
  }

  let nodeId = 0
  for (let i = 0; i < SHARD_COUNT; i++) {
    shardIds.push(nodeId)
    shardMemberMap[nodeId] = []
    nodeId += Math.floor(NODE_COUNT / SHARD_COUNT)
  }

  // Figure out which shard the node belongs to
  const view = VIEW.split(',')
  view.forEach((sock, idx) => {
    // Assing node to shard based on view index
    const shardId = shardIds[idx % SHARD_COUNT]
    shardMemberMap[shardId].push(sock)
  })
}

export const reshard = (shardCount: number) => {
  // Each shard must have at least two members for fault tolerance
  // If shardCount is the same as the current number of shards, do nothing
  if (
    shardCount <= 0 ||
    shardCount / view.size < 2 ||
    shardCount === shardIds.length
  ) {
    return
  }

  if (shardCount > shardIds.length) {
    addShards(shardCount - shardIds.length)
  } else {
    removeShards(shardIds.length - shardCount)
  }

  // Notify all nodes of the new shard configuration
  for (const sock of view) {
    if (sock !== socket) {
      fetch(`http://${sock}/reset/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          origin: socket,
        },
        body: JSON.stringify({
          shardIds,
          shardMemberMap,
        }),
      })
    }
  }
}

export const setShardIds = (newShardIds: number[]) => shardIds = newShardIds
export const setShardMemberMap = (newShardMemberMap: IShardMemberMap) => shardMemberMap = newShardMemberMap
export const setShardId = (newShardId: number) => shardId = newShardId