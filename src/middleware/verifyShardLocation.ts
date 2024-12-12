import { Request, Response, NextFunction } from 'express'
import { shardIds, shardId, shardMemberMap, hashKey } from '../util/shard'

const getTargetShardId = (key: string) => {
  const hash = hashKey(key)
  let targetShardId = shardIds[0]

  let left = 0
  let right = shardIds.length - 1

  // If hash is greater than the last shard ID, use first shard
  if (hash > shardIds[right]) {
    return targetShardId
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
  return targetShardId
}

// This middleware only works for KVS operations with a key url param
export const verifyShardLocation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const origin = req.headers.origin
  const control = req.headers['x-skip-validation'] === 'true'

  if (origin || control) {
    return next()
  }

  if (isNaN(shardId)) {
    res.status(403).send({
      error: 'Endpoint not allowed until node is assigned to a shard',
    })
    return
  }

  let targetShardId
  if (req.baseUrl === '/kvs') {
    targetShardId = getTargetShardId(req.params.key)
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
    const { method, body } = req
    const path = req.baseUrl + req.path
    // Randomly select a member of the target shard
    const randomIndex = Math.floor(Math.random() * shardMemberMap[targetShardId].length)
    const memberSocket = shardMemberMap[targetShardId][randomIndex]
    const response = await fetch(`http://${memberSocket}${path}}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
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
