import { Request, Response, NextFunction } from 'express'
import { NODE_COUNT, shardIds, shardId, shardMemberMap } from '../util/shard'
import md5 from 'md5'

const findTargetShardId = (hash: number) => {
  let left = 0
  let right = shardIds.length - 1
  let result

  // If hash is greater than the last shard ID, use first shard
  if (hash > shardIds[right]) {
    return shardIds[0]
  }

  while (left <= right) {
    const mid = Math.floor((left + right) / 2)

    if (shardIds[mid] < hash) {
      left = mid + 1
    } else {
      result = shardIds[mid]
      right = mid - 1
    }
  }
  return result!
}

// This middleware only works for KVS operations with a key url param
export const verifyShardLocation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const control = req.headers['x-skip-validation'] === 'true'
  const key = req.params.key!
  const { method, body } = req

  if (!control) {
    return next()
  }
  const hash = parseInt(md5(key), 16) % NODE_COUNT
  const targetShardId = findTargetShardId(hash)

  if (targetShardId === shardId) {
    return next()
  }

  try {
    const leaderSocket = shardMemberMap[targetShardId][0]
    const response = await fetch(`${leaderSocket}/kvs/${key}`, {
      method,
      body: JSON.stringify(body),
    })
    const status = response.status;
    const json = await response.json()
    res.status(status).send(json)
  } catch (e) {
    // TODO: Handle error
    res.status(500).send({ error: 'Something went wrong' })
  }
}
