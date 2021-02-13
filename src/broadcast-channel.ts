import { MessagePort, MessageChannel } from 'worker_threads'

export type BroadcastTransfer = Array<unknown>
export type BroadcastOptions = { targetOrigin?: string, transferList?: BroadcastTransfer }
export type BroadcastMessage = unknown

const DEFAULT_ORIGIN = '/'
const DISREGARD_ORIGIN = '*'

type Message = { type: string }
type NewClientMessage = Message & {
  type: 'new-broadcast-channel-please',
  name: string,
  port: MessagePort
}

type ClientItem = {
  name: string,
  port: MessagePort
}

type ServerState = {
  port: MessagePort,
  channels: Record<string, {
    clients: Array<ClientItem>
  }>
}

class BroadcastService {
  static init() {
    //console.debug('init')
    const mc = new MessageChannel()
    const state: ServerState = {
      port: mc.port1,
      channels: {
        // 'default': { clients: [] }
      }
    }

    state.port.on('message', message => {
      const { type, name, port } = message as NewClientMessage

      if(type !== 'new-broadcast-channel-please') { return }



      const client = { name, port }

      if(state.channels[name] === undefined) {
        state.channels[name] = { clients: [] }
      }

      const channel = state.channels[name]
      //channel.clients = [ client, ...(channel.clients) ]
      channel.clients.push(client)

      //console.log('new channel for', name, channel)

      client.port.on('message', message => {
        //console.log('message from channel client', message)
        // TODO how do we handles tranfer list here.
        //  what was the original tranfer list

        //console.log(channel.clients)

        const targets = channel.clients
          .filter(ci => ci.name === name)
          .filter(ci => ci.port !== port)
          //.sort((a, b) => a - b)

        //console.log({ targets })

        targets.forEach(client => client.port.postMessage(message))
      })

      client.port.on('close', () => {})
    })

    state.port.on('messageerror', error => {
      console.debug('message error')
    })

    state.port.on('close', () => {
      // release all clients

    })

    BroadcastChannel.broadcastChannelPort = mc.port2
  }

}

export class BroadcastChannel /*implements EventTarget*/ {

  public static broadcastChannelPort: MessagePort

  public readonly name
  private readonly port
  private onMessageFn

  public set onmessage(value) {
      this.onMessageFn = value
  }

  constructor(name) {
    this.name = name

    const mc = new MessageChannel
    this.port = mc.port1

    this.port.on('message', message => {
      //console.log('this port on message', this.onMessageFn)

      // dispatchEvent()
      this.onMessageFn({ data: message })
    })

    this.port.on('close', () => {

    })

    if(BroadcastChannel.broadcastChannelPort === undefined) {
      // BroadcastChannel.broadcastChannelPort = BroadcastService.init()
    }

    BroadcastChannel.broadcastChannelPort.postMessage({
      type: 'new-broadcast-channel-please',
      name,
      port: mc.port2
    }, [ mc.port2 ])
  }

  // addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
  //     throw new Error("Method not implemented.")
  // }

  // dispatchEvent(event: Event): boolean {
  //     throw new Error("Method not implemented.")
  // }

  // removeEventListener(type: string, callback: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {
  //     throw new Error("Method not implemented.")
  // }




  close() { this.port.close() }


  postMessage(message: BroadcastMessage, transfer_or_options?: BroadcastTransfer | BroadcastOptions) {
    const isTransfer = Array.isArray(transfer_or_options)

    const options = !isTransfer ? { targetOrigin: 'localhost' } : transfer_or_options as BroadcastOptions
    const transfer = isTransfer ? transfer_or_options as BroadcastTransfer : []

    const { targetOrigin } = options

    const isDefaultOrigin = targetOrigin === DEFAULT_ORIGIN
    // if deafult then user incumbbentSettings origin as targetOrigin

    const isDisregard = targetOrigin === DISREGARD_ORIGIN
    // if not disregard then upgrade targetOrigin to be the parseUrl of itself

    console.debug('broadcast', targetOrigin, isDefaultOrigin, isDisregard, transfer)

    this.port.postMessage(message, transfer_or_options)
  }
}


// ugh :(
  BroadcastService.init()




const A = { bc: new BroadcastChannel('urn:pacman25') }
const B = { bc: new BroadcastChannel('urn:pacman25') }

function handlePingPong(bc) {
  return (ev) => {
    console.debug('handlePingPong', ev)
    const message = JSON.parse(ev.data)

    const { type } = message
    switch(type) {
      case 'ping': {
        console.log('ping')
        setTimeout(()=> bc.postMessage(JSON.stringify({ type: 'pong' })), 1000)
      } break
      case 'pong': {
        console.log('ping')
        setTimeout(() => bc.postMessage(JSON.stringify({ type: 'ping' })), 1000)
      } break
      default: {
        console.warn('unknown message type', type)
        console.debug(message)
      } break
    }
  }
}

A.bc.onmessage = handlePingPong(A.bc)
B.bc.onmessage = handlePingPong(B.bc)

setImmediate(() => A.bc.postMessage(JSON.stringify({ type: 'ping' })))