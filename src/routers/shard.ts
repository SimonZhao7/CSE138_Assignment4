import { Router } from 'express'
import { reshard, shardId, shardIds, shardMemberMap } from '../util/shard'
import { socket, fillStore, store, view } from '../util/store'
import { verifyShardLocation } from '../middleware/verifyShardLocation'
import { vectorClock } from '../util/vectorClock'

export const shardRouter = Router()

shardRouter.get('/ids', (req, res) => {
  res.send({ 'shard-ids': shardIds })
})

shardRouter.get('/members/:id', (req, res) => {
  const id = parseInt(req.params.id)

  if (id in shardMemberMap) {
    res.send({ 'shard-members': shardMemberMap[id] })
  } else {
    res.status(404).send({ error: 'Shard ID not found' })
  }
})

shardRouter.put('/reshard', (req, res) => {
  if (req.body['shard-count'] === undefined) {
    res.status(400).send({ error: 'No shard-count provided' })
    return
  }

  const shardCount = parseInt(req.body['shard-count'])
  console.log(`Resharding to ${shardCount} shards`)

  if (view.size / shardCount < 2) {
    res.status(400).send({
      error:
        'Not enough nodes to provide fault tolerance with requested shard count',
    })
    return
  }
  reshard(shardCount)
  res.send({ result: 'resharded' })
})

shardRouter.get('/node-shard-id', (req, res) => {
  res.send({ 'node-shard-id': shardId })
})

// Shard Operations that may be forwarded to the correct member
shardRouter.use(verifyShardLocation)

shardRouter.get('/kvs/:id', (req, res) => {
  res.send({ store, 'causal-metadata': vectorClock })
})

shardRouter.get('/key-count/:id', async (req, res) => {
  res.send({ 'shard-key-count': Object.keys(store).length })
})

shardRouter.put('/add-member/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  const sock = req.body['socket-address']

  if (!view.has(sock)) {
    res.status(404).send({ error: 'Socket address not found in view' })
    return
  }

  // This needs to be broadcasted to all shards
  shardMemberMap[id].push(sock)
  fillStore(req, sock)
  console.log('Broadcasting to all members that new shard joined')
  for (const node of view) {
    fetch(`http://${node}/reset`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        origin: socket,
      },
      body: JSON.stringify({
        shardMemberMap: shardMemberMap,
      }),
    })
  }
  res.send({ result: 'node added to shard' })
})
