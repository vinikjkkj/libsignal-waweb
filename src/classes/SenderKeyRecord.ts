export class SenderKeyRecord {
    public _state: any

    constructor(state?: any) {
        this._state = state || { senderKeyStates: [] }
    }

    serialize() {
        return this._state
    }

    static deserialize(bufOrObj: any) {
        let obj = bufOrObj
        if (
            obj instanceof Uint8Array ||
            (typeof Buffer !== 'undefined' && (Buffer as any).isBuffer && Buffer.isBuffer(obj))
        ) {
            try {
                obj = JSON.parse(Buffer.from(obj).toString('utf-8'))
            } catch {}
        }
        return new SenderKeyRecord(obj || { senderKeyStates: [] })
    }
}
