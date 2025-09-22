import { ProtocolAddress } from './ProtocolAddress.js'

export class SenderKeyName {
    public groupId: string
    public addr: ProtocolAddress

    constructor(groupId: any, protocolAddress: any) {
        this.groupId = String(groupId)
        this.addr =
            protocolAddress instanceof ProtocolAddress
                ? protocolAddress
                : new ProtocolAddress(String(protocolAddress || ''))
    }

    toString() {
        return `${this.groupId}::${this.addr.toString()}`
    }
}
