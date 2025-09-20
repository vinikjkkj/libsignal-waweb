import { bootstrap, requireModule } from '../registry'
import { SessionRecord } from './SessionRecord'
import type { ISessionStore } from '../types'
import { toRaw32, toUint8 } from '../utils'

export class SessionBuilder {
    public store: ISessionStore
    public addr: any
    constructor(store: ISessionStore, protocolAddress: any) {
        this.store = store
        this.addr = protocolAddress
    }

    async initOutgoing(bundle: any) {
        await bootstrap()
        const Whitepaper = await requireModule<any>('WASignalWhitepaper')
        const Keys = await requireModule<any>('WASignalKeys')

        const ourId = await this.store.getOurIdentity()
        const toSer33 = (v: any) => {
            const x = toUint8(v)
            if (x.length === 33 && x[0] === 5) return x
            if (x.length === 32) return Keys.serializeIdentity(x)
            const raw = new Uint8Array(x.buffer, x.byteOffset, 32)
            return Keys.serializeIdentity(raw)
        }

        const local = {
            regId: await this.store.getOurRegistrationId(),
            staticKeyPair: {
                privateKey: toRaw32((ourId as any).privKey || (ourId as any).privateKey),
                publicKey: toRaw32((ourId as any).pubKey || (ourId as any).publicKey)
            }
        }

        const b = bundle || {}
        const pick = (...paths: any[]) => {
            for (const p of paths) {
                const parts = Array.isArray(p) ? p : String(p).split('.')
                let cur: any = b
                let ok = true
                for (const key of parts) {
                    if (cur && Object.prototype.hasOwnProperty.call(cur, key)) cur = cur[key]
                    else {
                        ok = false
                        break
                    }
                }
                if (ok && cur != null) return cur
            }
            return undefined
        }
        const identity = pick('identity', 'identityKey', 'pubKey', [
            'signedPreKeyBundle',
            'identityKey'
        ])
        const signedPub = pick(
            'signedKey.publicKey',
            'signedPreKey.publicKey',
            'signed.publicKey',
            ['signedPreKey', 'keyPair', 'publicKey'],
            ['signedPreKey', 'keyPair', 'pubKey'],
            ['signedKey', 'keyPair', 'publicKey'],
            ['signedKey', 'keyPair', 'pubKey']
        )
        const signedId = pick(
            'signedKey.id',
            'signedPreKey.id',
            'signedPreKey.keyId',
            'signed.id',
            ['signedKey', 'keyId']
        )
        const oneTimePub = pick(
            'oneTimeKey.publicKey',
            'preKey.publicKey',
            ['preKey', 'keyPair', 'publicKey'],
            ['preKey', 'keyPair', 'pubKey']
        )
        const oneTimeId = pick('oneTimeKey.id', 'preKey.id', 'preKey.keyId')
        const ratchetKey = pick('ratchetKey', 'baseKey', 'ephemeralKey')

        if (!identity) throw new Error('initOutgoing: bundle.identity missing')
        if (!signedPub) throw new Error('initOutgoing: bundle.signedKey.publicKey missing')
        if (signedId == null) throw new Error('initOutgoing: bundle.signedKey.id missing')

        const identitySer = toSer33(identity)
        const signedPubSer = toSer33(signedPub)
        const oneTimePubSer = oneTimePub ? toSer33(oneTimePub) : undefined
        const ratchetSer = ratchetKey ? toSer33(ratchetKey) : signedPubSer

        const clean = {
            regId: pick('regId', 'registrationId'),
            identity: identitySer,
            signedKey: { id: Number(signedId), publicKey: signedPubSer },
            ratchetKey: ratchetSer,
            oneTimeKey:
                oneTimePubSer && oneTimeId != null
                    ? { id: Number(oneTimeId), publicKey: oneTimePubSer }
                    : undefined
        }

        const session = await Whitepaper.initiateSessionOutgoing(
            local,
            clean,
            (local as any).staticKeyPair
        )
        await this.store.storeSession(this.addr.toString(), new SessionRecord(session))
    }
}
