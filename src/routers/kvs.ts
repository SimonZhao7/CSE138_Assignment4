import { Request, Response, Router } from 'express'
// Middleware
import { verifyCausalDependency } from '../middleware/verifyCausalDependancy'
// Util
import { vectorClock, updateVectorClock } from '../util/vectorClock'
import { broadcastChanges } from '../util/broadcastChanges'
import { store } from '../util/store'
import { verifyShardLocation } from '../middleware/verifyShardLocation'
import { shardId, shardMemberMap } from '../util/shard'

const kvsRouter = Router()

kvsRouter.use(verifyShardLocation)

kvsRouter.use(verifyCausalDependency(vectorClock))

kvsRouter.get('/:key', (req: Request, res: Response) => {
  const key = req.params.key

  if (key in store) {
    res.send({
      result: 'found',
      value: store[key],
      'causal-metadata': vectorClock,
    })
  } else {
    res.status(404).send({ error: 'Key does not exist' })
  }
})

kvsRouter.put('/:key', async (req: Request, res: Response) => {
  const key = req.params.key
  const value = req.body.value

  if (value === undefined) {
    res
      .status(400)
      .json({ error: 'PUT request does not specify a value' })

  } else if (key.length > 50) {
    res.status(400).json({ error: 'Key is too long' })

  } else {
    updateVectorClock(req)

    console.log(`PUT: ${key} - ${value}`)
    if (key in store) {
      store[key] = value
      broadcastChanges(req, shardMemberMap[shardId])
      console.log(`Replacing ${key}`)
      console.log('-----Current store------')
      console.log(store)
      res.status(200).json({ result: 'replaced', 'causal-metadata': vectorClock })
    } else {
      store[key] = value
      broadcastChanges(req, shardMemberMap[shardId])
      console.log(`Creating ${key}`)
      console.log('-----Current store------')
      console.log(store)
      res.status(201).json({ result: 'created', 'causal-metadata': vectorClock })
    }
    //console.log('ABOUT TO BROADCAST', vectorClock)
    //broadcastChanges(req)
  }
})

kvsRouter.delete('/:key', (req: Request, res: Response) => {
  const key = req.params.key

  if (!(key in store)) {
    res.status(404).json({ error: 'Key does not exist' })
  } else {

    updateVectorClock(req)
    delete store[key]
    res.status(200).json({ result: 'deleted', 'causal-metadata': vectorClock })
    broadcastChanges(req, shardMemberMap[shardId])
  }
})

export default kvsRouter
