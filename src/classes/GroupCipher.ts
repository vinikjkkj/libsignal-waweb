import { bootstrap, requireModule } from '../registry'
import { SenderKeyRecord } from './SenderKeyRecord'
import type { ISenderKeyStore } from '../types'
import { toUint8 } from '../utils'

export class GroupCipher {
    public store: ISenderKeyStore
    public senderKeyName: any

    constructor(store: ISenderKeyStore, senderKeyName: any) {
        this.store = store
        this.senderKeyName = senderKeyName
    }

    private async _normalizeInternal(s: any) {
        const GroupSession = await requireModule<any>('WASignalGroupSession')
        const arr = s && Array.isArray(s.senderKeyStates) ? s.senderKeyStates : []
        const out = arr.map((st: any) => {
            if (!st) return st
            if (st.senderSigningKey) {
                if (st.senderSigningKey.public) {
                    let pub = toUint8(st.senderSigningKey.public)
                    if (pub && pub.length === 32) {
                        const ser = new Uint8Array(33)
                        ser[0] = 0x05
                        ser.set(pub, 1)
                        pub = ser
                    }
                    st = { ...st, senderSigningKey: { ...st.senderSigningKey, public: pub } }
                }
                if (st.senderSigningKey.private) {
                    st = {
                        ...st,
                        senderSigningKey: {
                            ...st.senderSigningKey,
                            private: toUint8(st.senderSigningKey.private)
                        }
                    }
                }
            }
            if (st.senderChainKey && st.senderChainKey.seed) {
                st = {
                    ...st,
                    senderChainKey: {
                        ...st.senderChainKey,
                        seed: toUint8(st.senderChainKey.seed)
                    }
                }
            }
            if (Array.isArray(st.senderMessageKeys)) {
                st = {
                    ...st,
                    senderMessageKeys: st.senderMessageKeys.map((mk: any) =>
                        mk && mk.seed ? { ...mk, seed: toUint8(mk.seed) } : mk
                    )
                }
            }
            if (st.senderKeyChainKey && st.senderSigningKeyPublic) return st
            const parsed = GroupSession.parseSessionFromRecord({ senderKeyStates: [st] })
            return parsed.senderKeyStates[0]
        })
        return { senderKeyStates: out }
    }

    async encrypt(data: any): Promise<Uint8Array> {
        await bootstrap()
        const GroupCipher = await requireModule<any>('WASignalGroupCipher')
        const GroupSession = await requireModule<any>('WASignalGroupSession')
        const rec = await this.store.loadSenderKey(this.senderKeyName)
        if (!rec) throw new Error('No sender key state')

        const internal = await this._normalizeInternal(rec._state)
        const res = await GroupCipher.encryptSenderKeyMsgWithSession(internal, data)
        if (!res || !res.success) {
            const err = res && res.error ? res.error : 'unknown'
            throw new Error(`Group encrypt failed: ${err}`)
        }
        const [updatedSession, outBytes] = res.value
        const serialized = GroupSession.serializeSession(updatedSession)
        await this.store.storeSenderKey(this.senderKeyName, new SenderKeyRecord(serialized))
        return outBytes
    }

    async decrypt(ciphertext: any): Promise<Uint8Array | Buffer> {
        await bootstrap()
        const GroupCipher = await requireModule<any>('WASignalGroupCipher')
        const GroupSession = await requireModule<any>('WASignalGroupSession')
        const rec = await this.store.loadSenderKey(this.senderKeyName)
        if (!rec) throw new Error('No sender key state')

        const internal = await this._normalizeInternal(rec._state)
        const msgBytes = ciphertext instanceof Uint8Array ? ciphertext : new Uint8Array(ciphertext)
        const des = GroupCipher.deserializeSenderKeyMsg(msgBytes)
        if (!des || !des.success) {
            const err = des && des.error ? des.error : 'unknown'
            throw new Error(`Group msg parse failed: ${err}`)
        }
        const parsed = des.value
        const res = await GroupCipher.decryptSenderKeyMsgFromSession(internal, parsed)
        if (!res || !res.success) {
            const err = res && res.error ? res.error : 'unknown'
            throw new Error(`Group decrypt failed: ${err}`)
        }
        const [updatedSession, plaintext] = res.value
        const serialized = GroupSession.serializeSession(updatedSession)
        await this.store.storeSenderKey(this.senderKeyName, new SenderKeyRecord(serialized))
        const out = plaintext as Uint8Array
        return typeof Buffer !== 'undefined' && typeof Buffer.from === 'function'
            ? Buffer.from(out)
            : out
    }
}
