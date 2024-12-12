import { NextFunction, Request, Response } from 'express'
import { IVectorClock } from '../util/interfaces'

const sendErrorMessage = (res: Response) => {
  res
    .status(503)
    .json({ error: 'Causal dependencies not satisfied; try again later' })
}

const verifyCausalDependency = (vectorClock: IVectorClock) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin
    const control = req.headers['x-skip-validation'] === 'true'
    const metadata = req.body['causal-metadata']

    if (!metadata || control) {
      next()
    } else {
      /*
        1. The metadata must contain every socket the local clock describes
        2. For some socket, the local vector clock's value >= metadata value
        3. If the request was a broadcast from a sender socket, the local vector clock's value 
          for that socket must be exactly one less than the metadata's value for the same socket
      */
      for (const [sock, count] of Object.entries(vectorClock)) {
        const hasSocket = sock in metadata

        if (!hasSocket) {
          console.log(`Missing socket in causal metadata: ${sock}`)
          sendErrorMessage(res)
          return
        } else if (sock === origin && metadata[sock] !== count + 1) {
          console.log(`sock is not count + 1`)
          sendErrorMessage(res)
          return
        } else if (sock !== origin && metadata[sock] > count) {
          console.log(`sock !== origin and metadata[sock] > count`)
          console.log(`Sock = '${sock}', Origin = '${origin}'`)
          console.log(`Metadata[sock] = ${metadata[sock]},  Count: ${count}`)
          sendErrorMessage(res)
          return
        }
      }
      next()
    }
  }
}

export { verifyCausalDependency }
