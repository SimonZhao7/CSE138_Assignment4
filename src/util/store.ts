import { Request } from 'express'
import { vectorClock } from './vectorClock'
import { IKeyValuePairs, IResetDataJson } from './interfaces'
import { shardId } from './shard'

const socket = process.env.SOCKET_ADDRESS ?? ''
const viewAddresses = process.env.VIEW ?? ""
let view = new Set<string>(viewAddresses.split(','))
let store: IKeyValuePairs = {}


const setView = (newView: Set<string>) => view = newView

const setStore = (newStore: IKeyValuePairs) => store = newStore

const fillStore = async (req: Request, sock: string) => {
  const origin = req.headers.origin

  if (origin !== undefined) {
    return
  }

  console.log(`Sending full data to replica: ${sock}`)

  const data: IResetDataJson = {
    views: Array.from(view),
    store,
    'causal-metadata': vectorClock,
    shardId: shardId,
  }

  fetch(`http://${sock}/reset`, {
    method: 'PUT',
    body: JSON.stringify(data),
    headers: {
      origin: socket,
      'Content-Type': 'application/json',
      'X-Skip-Validation': 'true',
      'x-overwrite': 'true',
    },
  }).then(async (res) => {
    const json = await res.json()
    console.log(`Fill result: `)
    console.log(json)
  })
  .catch((e) => {
    console.log(`Fill error: ${e}`)
  })
}

export { socket, viewAddresses, view, store, fillStore, setView, setStore}
