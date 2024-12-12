import { Request, Response, Router } from 'express'
// Util
import {
  vectorClock,
  updateVectorClock,
} from '../util/vectorClock'
import { setStore, setView, store, view } from '../util/store'
import { IResetDataJson } from '../util/interfaces'
import { setShardId, setShardIds, setShardMemberMap } from '../util/shard'

const resetRouter = Router()

resetRouter.put('/', (req: Request, res: Response) => {
  const origin = req.headers.origin ?? ''
  const body: IResetDataJson = req.body

  if (!origin) {
    res.status(400).send({ error: 'Origin required to reset data' })
  } else {
    console.log('===== Resetting data =====')
    console.log(body)

    if (body.views && Array.isArray(body.views)) {
      setView(new Set(body.views))
    }

    if (body.shardIds && Array.isArray(body.shardIds)) {
      setShardIds(body.shardIds)
    }

    if (body.shardMemberMap !== undefined) {
      setShardMemberMap(body.shardMemberMap)
    }

    if (
      body.store &&
      typeof body.store === 'object' &&
      !Array.isArray(body.store) &&
      body.store !== null
    ) {
      setStore(body.store)
    }

    updateVectorClock(req)

    if (body.shardId !== undefined) {
      setShardId(body.shardId)
    }

    console.log('Updated View')
    console.log(view)
    console.log('Updated store')
    console.log(store)
    console.log('Updated vector clock')
    console.log(vectorClock)

    res.status(201).send({ message: 'Data reset successfully' })
  }
})

export default resetRouter
