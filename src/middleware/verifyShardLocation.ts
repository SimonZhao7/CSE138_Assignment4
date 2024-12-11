import { Request, Response, NextFunction } from 'express'
import { shardIds, shardId, shardMemberMap, hashKey } from '../util/shard'

const getTargetShardId = (req: Request) => {
  const key = req.params.key!

  const hash = hashKey(key)
  let targetShardId

  let left = 0
  let right = shardIds.length - 1

  // If hash is greater than the last shard ID, use first shard
  if (hash > shardIds[right]) {
    return shardIds[0]
  }

  while (left <= right) {
    const mid = Math.floor((left + right) / 2)

    if (shardIds[mid] < hash) {
      left = mid + 1
    } else {
      targetShardId = shardIds[mid]
      right = mid - 1
    }
  }
  return targetShardId!
}

// This middleware only works for KVS operations with a key url param
export const verifyShardLocation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { method, body } = req
  const origin = req.headers.origin
  const control = req.headers['x-skip-validation'] === 'true'

  if (origin || control) {
    return next()
  }

  let targetShardId;
  if (req.baseUrl === '/kvs') {
    targetShardId = getTargetShardId(req)
  } else {
    targetShardId = parseInt(req.params.id!)
    if (!(targetShardId in shardMemberMap)) {
      res.status(404).send({ error: 'Shard ID not found' })
      return
    }
  }

  if (targetShardId === shardId) {
    return next()
  }

  try {
    const path = req.baseUrl + req.path
    const leaderSocket = shardMemberMap[targetShardId][0]
    const response = await fetch(`http://${leaderSocket}${path}}`, {
      method,
      body: JSON.stringify(body),
    })
    const status = response.status
    const json = await response.json()
    res.status(status).send(json)
  } catch (e) {
    // TODO: Handle error
    res.status(500).send({ error: 'Something went wrong' })
  }
}
