export class SessionRecord {
    public _state: any
    constructor(state?: any) {
        this._state = state || null
    }
    serialize() {
        return this._state
    }
    static deserialize(obj: any) {
        return new SessionRecord(obj)
    }
}
