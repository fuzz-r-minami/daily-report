import { EventEmitter } from 'events'

/** アプリがカスタムスキーム URL（drepo://...）を受け取ったときに 'url' イベントを emit する */
export const protocolEmitter = new EventEmitter()
