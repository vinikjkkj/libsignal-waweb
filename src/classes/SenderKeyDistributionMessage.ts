export class SenderKeyDistributionMessage {
    private _payload: Uint8Array
    constructor(_a: any, _b: any, _c: any, _d: any, payload: Uint8Array) {
        this._payload = payload // Uint8Array protobuf
    }
    serialize() {
        return this._payload
    }
}
