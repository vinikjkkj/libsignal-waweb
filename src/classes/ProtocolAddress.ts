export class ProtocolAddress {
    public id: string
    public deviceId: number

    static from(encodedAddress: string): ProtocolAddress {
        if (typeof encodedAddress !== 'string' || !/.*\.\d+/.test(encodedAddress)) {
            throw new Error('Invalid address encoding')
        }
        const [id, dev] = encodedAddress.split('.')
        return new ProtocolAddress(id, parseInt(dev, 10))
    }

    constructor(id: string, deviceId: number = 0) {
        if (typeof id !== 'string') throw new TypeError('id required for addr')
        if (id.indexOf('.') !== -1) throw new TypeError('encoded addr detected')
        this.id = id
        this.deviceId = deviceId | 0
    }

    toString() {
        return `${this.id}.${this.deviceId}`
    }
    is(other: any) {
        return (
            other instanceof ProtocolAddress &&
            other.id === this.id &&
            other.deviceId === this.deviceId
        )
    }
}
