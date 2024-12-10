import { Request, Response, Router } from 'express'
// Util
import { vectorClock } from '../util/vectorClock'
import { broadcastChanges, broadcastChangesAsync } from '../util/broadcastChanges'
import { fillStore, view } from '../util/store'
import { headers } from '../util/constants'
import { calculateHeartbeatSocket } from '../util/heartbeat'

const viewRouter = Router()

viewRouter.get('/', (req: Request, res: Response) => {
  res.send({ view: [...view] })
})

viewRouter.put('/', (req: Request, res: Response) => {
  const socket = req.body['socket-address']
  if (socket === undefined) { 
    res
      .status(400)
      .send({ error: 'PUT request does not specify a socket-address' })

  } else if (view.has(socket)) {
    res.send({ result: 'already present' })

  } else {
    console.log('VIEW: PUT')
    view.add(socket)
    calculateHeartbeatSocket()
    console.log(view)
    vectorClock[socket] = vectorClock[socket] || 0
    broadcastChanges(req)

    fillStore(req, socket)

    res.status(201).send({ result: 'added' })
    
  }
})

viewRouter.delete('/', (req: Request, res: Response) => {
  const sock: string = req.body[headers.socketAddress] ?? ''
  console.log('Received DELETE request')

  if (sock === undefined) {
    res
      .status(400)
      .send({ error: `PUT request does not specify a ${headers.socketAddress}` })

  } else if (!view.has(sock)) {
    console.log('View')
    console.log(view)
    res.status(404).send({ error: 'View has no such replica' })
  } else {
    view.delete(sock)
    console.log('View')
    console.log(view)
    calculateHeartbeatSocket()
    console.log(`Deleted socket: ${sock}`)
    broadcastChanges(req)
    res.status(201).send({ result: 'deleted' })
  }
})

export default viewRouter
