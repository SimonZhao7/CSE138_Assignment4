import { Request } from 'express'
import { vectorClock } from './vectorClock'
import { socket, viewAddresses, view } from './store'
import { headers } from './constants'
import { IKeyValuePairs } from './interfaces'

const COOLDOWN_SECONDS = 1
const TIMEOUT_MS = 0.75 * 1000

const makeTimedRequest = async (req: Request, sock: string): Promise<Response | string> => {
  const { method, body, baseUrl, path } = req

  return new Promise(async (resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject('Request timed out')
    }, TIMEOUT_MS)

    const response = fetch(`http://${sock}${baseUrl}${path}`, {
      method,
      body: JSON.stringify({
        ...body,
        'causal-metadata': vectorClock,
      }),
      headers: {
        'Content-Type': 'application/json',
        origin: socket,
      },
    })
    clearTimeout(timeoutId)
    resolve(response)
  })
}

const retryUntilComplete = (req: Request, sock: string) => {
  const sendRequest = async () => {
    try {
      const res = await makeTimedRequest(req, sock)
      if (typeof res === 'string') throw new Error(res)

      const json = await res.json()
      console.log(sock, json)
      return res.status !== 503
    } catch (e) {
      // Send DELETE view to yourself to broadcast
      console.log(`${sock} DOWN. Removing...`)
      view.delete(sock)
      console.log('----View----')
      console.log(view)
      broadcastChangesAsync('view', 'DELETE', {[headers.socketAddress]: sock}, {origin: socket})
    }
  }

  sendRequest()
  /*if (await sendRequest()) {
    console.log(`${sock} ran well 1st time...`)
    return
  }
  console.log(`${sock} setting polling...`)

  const intervalId = setInterval(async () => {
    const success = await sendRequest()
    if (success) {
      clearInterval(intervalId)
    }
  }, COOLDOWN_SECONDS * 1000)*/
}

const broadcastChanges = (req: Request) => {
  const origin = req.headers.origin

  if (origin !== undefined) {
    return
  }

  for (const sock of view) {
    if (sock !== socket) {
      console.log(`BROADCAST TO: '${sock}'`)
      retryUntilComplete(req, sock)
    }
  }
}

const broadcastChangesAsync = async (endpoint: string, method: string, body: IKeyValuePairs, headers: IKeyValuePairs) => {
  for (const sock of view) {
    if (sock !== socket) {
      console.log(`Broadcast DELETE to: ${sock}`)
      console.log(`endpoint: ${endpoint}`)
      console.log(`method: ${method}`)
      console.log('body:')
      console.log(body)

      try {
        const response = await sendRequestAsync(`http://${sock}/${endpoint}`, method, body, headers)
        const json = await response.json()
        console.log(`${sock} delete broadcast result:`, json)
      } catch (e) {
        console.log(`${sock} remove failed`)
      }
    }
  }
}

const sendRequestAsync = async (url: string, method: string, body: IKeyValuePairs, headers: IKeyValuePairs) => {
  
  return await fetch(url, {
    method,
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
  })
}


export { broadcastChanges, broadcastChangesAsync }
