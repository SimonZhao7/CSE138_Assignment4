import { Router, Request, Response } from 'express'

const statusRouter = Router()

statusRouter.head('/', (req: Request, res: Response) => {
  res.status(200).end()
})

export default statusRouter
