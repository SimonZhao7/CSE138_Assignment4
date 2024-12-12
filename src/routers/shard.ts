import { Router } from 'express'
import { reshard, shardId, shardIds, shardMemberMap } from '../util/shard'
import { fillStore, store, view } from '../util/store'
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
  const shardCount = parseInt(req.body['shard-count'])

  if (req.body['shard-count'] === undefined) {
    res.status(400).send({ error: 'No shard-count provided' })
  }

  if (view.size / shardCount < 2) {
    res.status(400).send({
      error:
        'Not enough nodes to provide fault tolerance with requested shard count',
    })
  }
  reshard(shardCount)
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
  res.send({ result: 'node added to shard' })
})
