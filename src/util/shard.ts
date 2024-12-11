import { IShardMemberMap } from './interfaces'

// What to do if a new member joins the view?
const SHARD_COUNT = Number(process.env.SHARD_COUNT)
const VIEW = process.env.VIEW!
const socket = process.env.SOCKET_ADDRESS!

export const NODE_COUNT = 2 ** 32

export const shardIds: number[] = []
export const shardMemberMap: IShardMemberMap = {}
export let shardId: number | undefined;


// Assumes each shard has at least two members for fault tolerance
if (SHARD_COUNT > 0) {
  let nodeId = 0
  for (let i = 0; i < SHARD_COUNT; i++) {
    shardIds.push(nodeId)
    shardMemberMap[nodeId] = []
    nodeId += Math.floor(NODE_COUNT / SHARD_COUNT)
  }

  // Figure out which shard the node belongs to
  const view = VIEW.split(',')
  const idx = view.findIndex(x => x === socket)

  if (idx !== -1) {
    // Assing node to shard based on view index
    const shardId = shardIds[idx % SHARD_COUNT];
    shardMemberMap[shardId].push(socket)
  }
}
