const textDecoder = new TextDecoder()

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
        if (obj instanceof Uint8Array) {
            try {
                obj = JSON.parse(textDecoder.decode(obj))
            } catch {}
        }
        return new SenderKeyRecord(obj || { senderKeyStates: [] })
    }
}
